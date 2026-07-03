"""
청약 RAG - 전체 ChromaDB 구축 일괄 실행 스크립트
────────────────────────────────────────────────────────────────
6개 collection을 한 번에 (재)생성합니다.

    law_chunks       ← 주택공급에 관한 규칙 (HWP/HWPML)
    faq_chunks       ← 2024 주택청약 FAQ (PDF)
    manual_chunks    ← 주택공급 업무매뉴얼 (PDF)
    lh_guide_chunks  ← LH 분양가이드 4종 (PDF)
    web_faq_chunks   ← 청약홈/마이홈 FAQ (JSON)
    guide_chunks     ← 청약제도안내 (Markdown)

사용법:
    python build_all.py            # 전체 실행
    python build_all.py law faq    # 일부만 실행
────────────────────────────────────────────────────────────────
프로젝트 구조:

    Backend/
    ├── data/                          ← 원본 문서 전부 여기
    │   ├── *.hwp
    │   ├── *.pdf
    │   ├── *.json
    │   └── *.md
    │
    └── src/
        └── preprocessing/
            ├── chroma_db/              ← 결과 저장 위치
            ├── chunker/
            │   ├── law_chunker.py
            │   ├── faq_chunker.py
            │   ├── manual_chunker.py
            │   ├── lh_guide_chunker.py
            │   ├── web_faq_chunker.py
            │   └── md_table_chunker.py
            ├── execute/
            └── build_all.py            ← 이 파일 (preprocessing/ 바로 아래)
────────────────────────────────────────────────────────────────
"""

import os
import re
import sys
import chromadb
from chromadb.utils import embedding_functions
from dotenv import load_dotenv

load_dotenv()

# ── 경로 설정 ──────────────────────────────────────────────────

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))      # .../Backend/src/preprocessing
DATA_DIR    = os.path.join(BASE_DIR, "..", "..", "data")        # .../Backend/data
CHUNKER_DIR = os.path.join(BASE_DIR, "chunker")
CHROMA_PATH = os.path.join(BASE_DIR, "chroma_db")

sys.path.insert(0, CHUNKER_DIR)

# data/ 안의 실제 파일명 (환경에 맞게 수정)
INPUT_FILES = {
    "law_hwp":        "주택공급에 관한 규칙(국토교통부령)(제01531호)(20251031) (1).hwp",
    "faq_pdf":        "2024_주택청약_FAQ.pdf",
    "manual_pdf":     "주택공급_업무_매뉴얼.pdf",
    "guide_procedure": "guide_procedure.pdf",
    "guide_general":   "guide_general.pdf",
    "guide_special":   "guide_special.pdf",
    "guide_transfer":  "guide_transfer.pdf",
    "myhome_json":    "myhome_faq_raw.json",
    "applyhome_json": "applyhome_faq_raw.json",
    "guide_md":       "청약제도안내.md",
}

EMBEDDING_MODEL = "text-embedding-3-small"


# ── 공통 유틸 ──────────────────────────────────────────────────

def get_ef():
    return embedding_functions.OpenAIEmbeddingFunction(
        api_key=os.getenv("OPENAI_API_KEY"),
        model_name=EMBEDDING_MODEL,
    )


def recreate_collection(client, name, ef):
    """기존 collection 삭제 후 재생성"""
    try:
        client.delete_collection(name)
    except Exception:
        pass
    return client.create_collection(name=name, embedding_function=ef)


def data_path(key: str) -> str:
    return os.path.join(DATA_DIR, INPUT_FILES[key])


def check_exists(*paths: str) -> list[str]:
    """존재하지 않는 경로 목록 반환"""
    return [p for p in paths if not os.path.exists(p)]


# ── 1. 법령 ──────────────────────────────────────────────────────

def build_law(client, ef):
    print("\n[1/6] law_chunks 빌드 중...")
    from law_chunker import LawChunker

    hwp_path = data_path("law_hwp")
    if check_exists(hwp_path):
        print(f"  ⚠ 파일 없음: {hwp_path} (건너뜀)")
        return

    with open(hwp_path, encoding="utf-8") as f:
        content = f.read()

    # HWPML(XML) → 텍스트 추출
    chars = re.findall(r'<CHAR[^>]*>([^<]+)</CHAR>', content)
    text = "\n".join(chars)
    text = (text.replace("&nbsp;", " ")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&amp;", "&"))
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)

    chunker = LawChunker(law_name="주택공급에 관한 규칙")
    chunks = chunker.chunk(text)

    col = recreate_collection(client, "law_chunks", ef)
    chunker.add_to_chroma(chunks, col)


# ── 2. FAQ ───────────────────────────────────────────────────────

def build_faq(client, ef):
    print("\n[2/6] faq_chunks 빌드 중...")
    from faq_chunker import FAQChunker

    pdf_path = data_path("faq_pdf")
    if check_exists(pdf_path):
        print(f"  ⚠ 파일 없음: {pdf_path} (건너뜀)")
        return

    chunker = FAQChunker(pdf_path)
    chunks = chunker.chunk()

    col = recreate_collection(client, "faq_chunks", ef)
    chunker.add_to_chroma(chunks, col)


# ── 3. 매뉴얼 ─────────────────────────────────────────────────────

def build_manual(client, ef):
    print("\n[3/6] manual_chunks 빌드 중...")
    from manual_chunker import ManualChunker

    pdf_path = data_path("manual_pdf")
    if check_exists(pdf_path):
        print(f"  ⚠ 파일 없음: {pdf_path} (건너뜀)")
        return

    chunker = ManualChunker(pdf_path)
    chunks = chunker.chunk()

    col = recreate_collection(client, "manual_chunks", ef)
    chunker.add_to_chroma(chunks, col)


# ── 4. LH 분양가이드 ───────────────────────────────────────────────

def build_lh_guide(client, ef):
    print("\n[4/6] lh_guide_chunks 빌드 중...")
    from lh_guide_chunker import LHGuideChunker

    paths = {
        k: data_path(k)
        for k in ("guide_procedure", "guide_general", "guide_special", "guide_transfer")
    }
    missing = check_exists(*paths.values())
    if missing:
        print(f"  ⚠ 파일 없음: {missing} (건너뜀)")
        return

    chunker = LHGuideChunker(
        procedure_pdf=paths["guide_procedure"],
        general_supply_pdf=paths["guide_general"],
        special_supply_pdf=paths["guide_special"],
        transfer_limit_pdf=paths["guide_transfer"],
    )
    chunks = chunker.chunk()

    col = recreate_collection(client, "lh_guide_chunks", ef)
    chunker.add_to_chroma(chunks, col)


# ── 5. 청약홈/마이홈 FAQ ────────────────────────────────────────────

def build_web_faq(client, ef):
    print("\n[5/6] web_faq_chunks 빌드 중...")
    from web_faq_chunker import WebFAQChunker

    myhome_path = data_path("myhome_json")
    applyhome_path = data_path("applyhome_json")

    missing = check_exists(myhome_path, applyhome_path)
    if missing:
        print(f"  ⚠ 파일 없음: {missing} (건너뜀)")
        return

    chunker = WebFAQChunker(
        myhome_json=myhome_path,
        applyhome_json=applyhome_path,
    )
    chunks = chunker.chunk()

    col = recreate_collection(client, "web_faq_chunks", ef)
    chunker.add_to_chroma(chunks, col)


# ── 6. 청약제도안내 (MD) ─────────────────────────────────────────────

def build_guide_md(client, ef):
    print("\n[6/6] guide_chunks 빌드 중...")
    from md_table_chunker import MDTableChunker
    from langchain_chroma import Chroma
    from langchain_openai import OpenAIEmbeddings

    md_path = data_path("guide_md")
    if check_exists(md_path):
        print(f"  ⚠ 파일 없음: {md_path} (건너뜀)")
        return

    chunker = MDTableChunker(md_path)
    docs = chunker.chunk()

    try:
        client.delete_collection("guide_chunks")
    except Exception:
        pass

    embedding_model = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    Chroma.from_documents(
        documents=docs,
        embedding=embedding_model,
        persist_directory=CHROMA_PATH,
        collection_name="guide_chunks",
    )
    print(f"  [guide_chunks] {len(docs)}개 청크 저장 완료")


# ── 메인 ────────────────────────────────────────────────────────

BUILDERS = {
    "law": build_law,
    "faq": build_faq,
    "manual": build_manual,
    "lh_guide": build_lh_guide,
    "web_faq": build_web_faq,
    "guide": build_guide_md,
}


def main():
    """
    루트에서 실행해도 Backend/data 원본 문서를 읽어 ChromaDB를 재생성합니다.
    OPENAI_API_KEY는 실행 위치의 .env 또는 OS 환경변수에 있어야 합니다.
    """
    targets = sys.argv[1:] or list(BUILDERS.keys())

    invalid = [t for t in targets if t not in BUILDERS]
    if invalid:
        print(f"알 수 없는 대상: {invalid}")
        print(f"사용 가능: {list(BUILDERS.keys())}")
        sys.exit(1)

    print(f"빌드 대상: {targets}")
    print(f"data 경로:     {os.path.abspath(DATA_DIR)}")
    print(f"chroma_db 경로: {os.path.abspath(CHROMA_PATH)}")

    os.makedirs(CHROMA_PATH, exist_ok=True)

    client = chromadb.PersistentClient(path=CHROMA_PATH)
    ef = get_ef()

    for name in targets:
        try:
            BUILDERS[name](client, ef)
        except Exception as e:
            print(f"  ❌ {name} 실패: {e}")

    # 결과 요약
    print("\n" + "=" * 50)
    print("최종 결과")
    print("=" * 50)
    for col in client.list_collections():
        print(f"  {col.name}: {col.count()}개")


if __name__ == "__main__":
    main()
