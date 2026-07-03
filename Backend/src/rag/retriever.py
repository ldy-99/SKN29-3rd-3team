"""
청약 RAG 검색 모듈 (retriever)
────────────────────────────────────────────────────────────────
역할:
    1. search_all()    : 6개 ChromaDB collection을 통합 검색해
                          거리 기준 상위 N개 청크 반환
    2. format_source() : collection별로 다른 metadata 구조를
                          사람이 읽을 수 있는 출처 라벨 한 줄로 변환

LLM을 호출하지 않음 — 순수 "검색" 단계.
(질문 → 임베딩 → 벡터 검색 → 결과 반환)

────────────────────────────────────────────────────────────────
프로젝트 구조 (이 파일은 src/rag/retriever.py):

    프로젝트/
    ├── data/
    └── src/
        ├── preprocessing/
        │   └── chroma_db/      ← 검색 대상 DB
        └── rag/
            ├── retriever.py    ← 이 파일
            └── rag_graph.py
────────────────────────────────────────────────────────────────
사용법:
    from retriever import search_all, format_source

    results = search_all("신혼부부 특별공급 소득 기준")
    for dist, doc, meta, col in results:
        print(format_source(meta, col), dist)
────────────────────────────────────────────────────────────────
"""

import os
import chromadb
from chromadb.utils import embedding_functions
from dotenv import load_dotenv

load_dotenv()

# ── 경로 설정 ──────────────────────────────────────────────────
# 이 파일(src/rag/retriever.py) 기준 → src/preprocessing/chroma_db
#BASE_DIR = os.path.dirname(os.path.abspath(__file__))
#CHROMA_PATH = os.path.join(BASE_DIR, "..", "preprocessing", "chroma_db")

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__)) # src/rag
BASE_DIR = os.path.dirname(CURRENT_DIR)                 # src
PROJECT_ROOT = os.path.dirname(BASE_DIR)                # 프로젝트 루트

# ⭕ 가장 안전한 절대 경로 지정
CHROMA_PATH = os.path.join(PROJECT_ROOT, "src", "preprocessing", "chroma_db")

COLLECTIONS = [
    "law_chunks",
    "faq_chunks",
    "manual_chunks",
    "lh_guide_chunks",
    "web_faq_chunks",
    "guide_chunks",
]

EMBEDDING_MODEL = "text-embedding-3-small"

# 검색 결과가 이 값보다 멀면(=관련성 낮음) "검색결과 없음"으로 처리
DEFAULT_DISTANCE_THRESHOLD = 0.55
# guide_chunks는 다른 collection 대비 거리값이 체계적으로 높게 나오므로
# (질문-문서 형태 불일치로 인한 스케일 차이) 보정용 offset 적용
DISTANCE_OFFSET = {
    "guide_chunks": 0.45,
}


# ── 쿼리 라우팅 규칙 ────────────────────────────────────────────────
# 질문에 특정 키워드가 포함되면, 우선적으로 검색할 collection을 좁힘.
# (예: "전매제한" 관련 질문은 law_chunks가 약하고
#      lh_guide_chunks / web_faq_chunks가 강함 — 이전 분석 결과 반영)
#
# 매칭되는 규칙이 없으면 전체 COLLECTIONS를 검색함.
ROUTING_RULES: list[tuple[list[str], list[str]]] = [
    (
        ["전매제한", "전매", "전매행위"],
        ["lh_guide_chunks", "web_faq_chunks", "faq_chunks"],
    ),
    (
        ["거주의무", "분양가상한제"],
        ["lh_guide_chunks", "faq_chunks", "law_chunks"],
    ),
    (
        ["가점", "가점제", "무주택기간", "부양가족"],
        ["guide_chunks", "web_faq_chunks", "manual_chunks"],
    ),
    (
        ["소득기준", "소득 기준", "월평균소득", "%"],
        ["lh_guide_chunks", "guide_chunks", "web_faq_chunks"],
    ),
    (
        ["특별공급","특공", "신혼부부", "신혼특공", "다자녀", "노부모", "생애최초", "생초", "신생아"],
        ["lh_guide_chunks", "web_faq_chunks", "faq_chunks"],
    ),
]


def route_collections(
    query: str,
    priority_k: int = 5,
    fallback_k: int = 1,
) -> list[tuple[str, int]]:
    """
    질문 텍스트에 포함된 키워드를 기준으로 collection별 검색 개수(k)를 결정.

    - 라우팅 규칙에 매칭된 collection: priority_k개 검색
    - 매칭되지 않은 나머지 collection: fallback_k개 검색 (검색 누락 방지용 최소량)
    - 매칭되는 규칙이 전혀 없으면: 전체 collection을 priority_k개씩 검색

    Returns:
        [(collection_name, k), ...]  — 우선순위 순서로 정렬됨
    """
    matched: list[str] = []

    for keywords, collections in ROUTING_RULES:
        if any(kw in query for kw in keywords):
            for c in collections:
                if c not in matched:
                    matched.append(c)

    if not matched:
        return [(c, priority_k) for c in COLLECTIONS]

    result = [(c, priority_k) for c in matched]
    for c in COLLECTIONS:
        if c not in matched:
            result.append((c, fallback_k))

    return result



# ── 초기화 ──────────────────────────────────────────────────────

_ef = embedding_functions.OpenAIEmbeddingFunction(
    api_key=os.getenv("OPENAI_API_KEY"),
    model_name=EMBEDDING_MODEL,
)

_client = chromadb.PersistentClient(path=CHROMA_PATH)


# ── 1. 통합 검색 ──────────────────────────────────────────────────

def search_all(
    query: str,
    k_per_collection: int = 3,
    top_k: int = 5,
    collections: list[str] | None = None,
) -> list[tuple[float, str, dict, str]]:
    """
    질문 하나를 받아 지정된(또는 전체) collection을 각각 검색하고,
    결과를 모두 합친 뒤 거리(distance) 오름차순으로 정렬해 상위 top_k개만 반환.

    Args:
        query: 검색할 질문
        k_per_collection: collection 1개당 가져올 결과 수
        top_k: 최종적으로 반환할 결과 수
        collections: 검색할 collection 이름 목록 (None이면 전체)

    Returns:
        [(distance, document, metadata, collection_name), ...]
        distance가 작을수록 질문과 더 유사함 (코사인 거리)
    """
    target_collections = collections or COLLECTIONS
    all_results: list[tuple[float, str, dict, str]] = []

    for name in target_collections:
        try:
            col = _client.get_collection(name, embedding_function=_ef)
        except Exception as e:
            print(f"[retriever] collection '{name}' 조회 실패: {e}")
            continue

        try:
            res = col.query(query_texts=[query], n_results=k_per_collection)
        except Exception as e:
            print(f"[retriever] collection '{name}' 검색 실패: {e}")
            continue

        # query_texts에 질문을 1개만 넣었으므로 항상 [0] 인덱스 사용
        docs  = res["documents"][0]
        metas = res["metadatas"][0]
        dists = res["distances"][0]

        offset = DISTANCE_OFFSET.get(name, 0.0)

        for doc, meta, dist in zip(docs, metas, dists):
            adjusted_dist = max(dist - offset, 0.0)
            all_results.append((adjusted_dist, doc, meta, name))

    all_results.sort(key=lambda x: x[0])
    return all_results[:top_k]


# ── 1-0. collection별로 다른 k값을 적용하는 검색 ──────────────────────

def search_weighted(
    query: str,
    collection_k_pairs: list[tuple[str, int]],
    top_k: int = 5,
) -> list[tuple[float, str, dict, str]]:
    """
    collection마다 서로 다른 n_results(k)를 적용해 검색한 뒤,
    결과를 합쳐 거리 오름차순으로 정렬 후 상위 top_k개 반환.

    Args:
        query: 검색 질문
        collection_k_pairs: [(collection_name, k), ...]
        top_k: 최종 반환 개수

    Returns:
        [(distance, document, metadata, collection_name), ...]
    """
    all_results: list[tuple[float, str, dict, str]] = []

    for name, k in collection_k_pairs:
        if k <= 0:
            continue
        try:
            col = _client.get_collection(name, embedding_function=_ef)
        except Exception as e:
            print(f"[retriever] collection '{name}' 조회 실패: {e}")
            continue

        try:
            res = col.query(query_texts=[query], n_results=k)
        except Exception as e:
            print(f"[retriever] collection '{name}' 검색 실패: {e}")
            continue

        docs  = res["documents"][0]
        metas = res["metadatas"][0]
        dists = res["distances"][0]

        offset = DISTANCE_OFFSET.get(name, 0.0)

        for doc, meta, dist in zip(docs, metas, dists):
            adjusted_dist = max(dist - offset, 0.0)
            all_results.append((adjusted_dist, doc, meta, name))

    all_results.sort(key=lambda x: x[0])
    return all_results[:top_k]


# ── 1-1. Threshold + 라우팅 통합 검색 ──────────────────────────────

def search(
    query: str,
    priority_k: int = 5,
    fallback_k: int = 1,
    top_k: int = 5,
    threshold: float = DEFAULT_DISTANCE_THRESHOLD,
    use_routing: bool = True,
) -> dict:
    """
    (1) 쿼리 라우팅, (2) 거리 임계값 필터링을 적용한 통합 검색.

    동작 순서:
        1. use_routing=True면 route_collections()로 collection별 검색 개수(k) 결정
           - 라우팅 규칙에 매칭된 collection은 priority_k개
           - 매칭 안 된 나머지 collection은 fallback_k개 (검색 누락 방지용 최소량)
           - 매칭되는 규칙이 없으면 전체 collection을 priority_k개씩
        2. search_weighted()로 통합 검색
        3. 최소 거리(min distance)가 threshold를 초과하면
           결과 없이 "검색결과 없음" 상태로 반환

    Args:
        query: 검색 질문
        priority_k: 라우팅 우선 collection에서 가져올 결과 수
        fallback_k: 그 외 collection에서 가져올 결과 수
        top_k: 최종 반환할 결과 수
        threshold: 이 값보다 min distance가 크면 결과를 비움
        use_routing: 키워드 기반 collection 라우팅 사용 여부

    Returns:
        {
            "found": bool,                     # False면 results는 빈 리스트
            "results": [(distance, document, metadata, collection_name), ...],
            "min_distance": float | None,      # 검색 결과가 없으면 None
            "routed_collections": list[tuple[str, int]],  # 실제 사용된 (collection, k)
        }
    """
    if use_routing:
        collection_k_pairs = route_collections(query, priority_k=priority_k, fallback_k=fallback_k)
    else:
        collection_k_pairs = [(c, priority_k) for c in COLLECTIONS]

    results = search_weighted(query, collection_k_pairs, top_k=top_k)

    if not results:
        return {
            "found": False,
            "results": [],
            "min_distance": None,
            "routed_collections": collection_k_pairs,
        }

    top_n = min(3, len(results))
    top_docs = results[:top_n]

    min_distance = results[0][0]

    avg_distance = (
        sum(r[0] for r in top_docs)
        / top_n
    )

    if avg_distance > threshold:
        return {
            "found": False,
            "results": [],
            "min_distance": min_distance,
            "avg_distance": avg_distance,
            "routed_collections": collection_k_pairs,
        }

    return {
        "found": True,
        "results": results,
        "min_distance": min_distance,
        "avg_distance": avg_distance,
        "routed_collections": collection_k_pairs,
    }


# ── 2. 출처 라벨 변환 ──────────────────────────────────────────────

def format_source(meta: dict, collection_name: str) -> str:
    """
    metadata + collection명 → 사람이 읽을 수 있는 출처 라벨.

    예시:
        law_chunks       → "주택공급에 관한 규칙 제41조(신혼부부 특별공급) 제3항"
        faq_chunks       → "2024 주택청약 FAQ Q98"
        manual_chunks    → "주택공급 업무 매뉴얼 Q4-37"
                           또는 "주택공급 업무 매뉴얼 제4장 제4절 특별공급"
        lh_guide_chunks  → "LH 분양가이드 - 신혼부부 특별공급"
        web_faq_chunks   → "청약홈 - 청약통장 (청약통장의 가입)"
        guide_chunks     → "청약Home 청약제도안내 - 특별공급 > 생애최초 (공공주택)"
    """
    if collection_name == "law_chunks":
        return _format_law_source(meta)

    if collection_name == "faq_chunks":
        return _format_faq_source(meta)

    if collection_name == "manual_chunks":
        return _format_manual_source(meta)

    if collection_name == "lh_guide_chunks":
        return _format_lh_guide_source(meta)

    if collection_name == "web_faq_chunks":
        return _format_web_faq_source(meta)

    if collection_name == "guide_chunks":
        return _format_guide_md_source(meta)

    return collection_name


def _format_law_source(meta: dict) -> str:
    law = meta.get("law", "주택공급에 관한 규칙")
    article = meta.get("article", "")
    title = meta.get("article_title", "")
    para = meta.get("paragraph", "")
    item = meta.get("item", "")
    item_sub = meta.get("item_sub", "")

    label = law
    if article:
        label += f" 제{article}조"
        if title:
            label += f"({title})"
    if para:
        label += f" 제{para}항"
    if item:
        label += f" 제{item}호"
    if item_sub:
        label += f" {item_sub}목"
    return label


def _format_faq_source(meta: dict) -> str:
    source = meta.get("source", "2024 주택청약 FAQ")
    q_num = meta.get("q_number", "")
    label = source
    if q_num != "":
        label += f" Q{q_num}"
    return label


def _format_manual_source(meta: dict) -> str:
    source = meta.get("source", "주택공급 업무 매뉴얼")
    q_num = meta.get("q_number", "")
    if q_num:
        return f"{source} {q_num}"

    chapter = meta.get("chapter", "")
    section = meta.get("section_title") or meta.get("section", "")
    subsection = meta.get("subsection", "")

    label = source
    extra = " ".join(p for p in [chapter, section, subsection] if p and p != "(도입)")
    if extra:
        label += f" {extra}"
    return label


def _format_lh_guide_source(meta: dict) -> str:
    source = meta.get("source", "LH 분양가이드")
    supply_type = meta.get("supply_type", "")
    section_title = meta.get("section_title", "")
    page = meta.get("page", "")

    detail = supply_type or section_title or page
    if detail and detail != "공통":
        return f"{source} - {detail}"
    return source


def _format_web_faq_source(meta: dict) -> str:
    source = meta.get("source", "")
    category = meta.get("category", "")
    subcategory = meta.get("subcategory", "")

    label = source
    if category:
        label += f" - {category}"
    if subcategory:
        label += f" ({subcategory})"
    return label


def _format_guide_md_source(meta: dict) -> str:
    source = meta.get("source", "청약Home 청약제도안내")
    h2 = meta.get("Header_2", "")
    h3 = meta.get("Header_3", "")

    path = " > ".join(p for p in [h2, h3] if p)
    if path:
        return f"{source} - {path}"
    return source


# ── CLI 테스트 ───────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    query = " ".join(sys.argv[1:]) or "LTV 기준"

    print(f"질문: {query}\n")

    result = search(query)
    print(f"라우팅된 collection 순서: {result['routed_collections']}")
    print(f"최소 거리: {result['min_distance']}")

    if not result["found"]:
        print("\n검색결과 없음")
    else:
        for i, (dist, doc, meta, col) in enumerate(result["results"], 1):
            print(f"\n[{i}] 거리={dist:.4f} | {format_source(meta, col)}")
            print(f"    {doc[:100].replace(chr(10), ' ')}...")
