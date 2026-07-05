"""
Node 5 RAG 연동 툴
- check_regional_priority: 지역 우선공급 확인 (3번)
- analyze_subscription_timing: 청약 시점 적합성 분석 (7번)
"""

import os
import sys

import importlib.util
from functools import lru_cache
from pathlib import Path
from types import ModuleType
from datetime import date


from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from src.engine.llm_safety import LLMCallError, safe_llm_call

# ── retriever.py 경로 설정 ────────────────────────────────────────
RAG_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),  # engine/tools/
    "..", "..", "rag"                             # src/rag/
)
sys.path.insert(0, RAG_DIR)

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# ── 공통 RAG 답변 생성 함수 ───────────────────────────────────────

def _rag_answer(query: str, system_prompt: str) -> dict:
    """
    retriever로 context를 검색하고 LLM으로 답변을 생성합니다.
    검색 결과가 없으면 found=False를 반환합니다.
    """
    retriever = _load_retriever()

    try:
        result = retriever.search(query)
    except Exception as exc:
        print(f"[rag_tools] RAG 검색 실패: {exc}")
        return {
            "found": False,
            "answer": "RAG 검색 중 오류가 발생해 관련 근거를 확인하지 못했습니다.",
            "sources": [],
            "error": str(exc),
        }

    if not result["found"]:
        return {
            "found": False,
            "answer": "제공된 자료에서 관련 정보를 찾을 수 없습니다.",
            "sources": [],
        }

    context_parts = []
    sources = []
    for dist, doc, meta, col_name in result["results"]:
        label = retriever.format_source(meta, col_name)

        context_parts.append(f"[출처: {label}]\n{doc}")
        sources.append({"label": label, "distance": round(dist, 4)})

    context = "\n\n---\n\n".join(context_parts)

    prompt = ChatPromptTemplate.from_template(
        """{system_prompt}

아래 [Context]의 내용에만 기반하여 답변하세요.
Context에 없는 내용은 "제공된 자료에서는 확인할 수 없습니다"라고 명시하세요.
마크다운 헤더(#, ##)나 굵은글씨(**)는 사용하지 마세요.
답변 마지막에 추가 질문 유도 멘트는 넣지 마세요.

[Context]
{context}

질문: {query}

답변:"""
    )


    chain = prompt | llm | StrOutputParser()

    try:
        answer = safe_llm_call(
            lambda: chain.invoke({
                "system_prompt": system_prompt,
                "context": context,
                "query": query,
            }),
            node_name="rag_tools._rag_answer",
        )
    except LLMCallError as exc:
        # 검색된 근거 자료는 이미 있으니, 답변 생성만 실패했다는 걸 명시하고
        # 출처(sources)는 그대로 넘겨서 호출부(node5 agent)가 참고할 수 있게 함.
        print(f"[rag_tools] {exc}")
        return {
            "found": False,
            "answer": "AI 답변 생성 중 오류가 발생해 근거 자료 검색 결과만 참고용으로 제공합니다.",
            "sources": sources,
            "error": str(exc.original) if exc.original else str(exc),
        }

    return {
        "found": True,
        "answer": answer,
        "sources": sources,
    }


@lru_cache(maxsize=1)
def _load_retriever() -> ModuleType:
    retriever_path = Path(__file__).resolve().parents[2] / "rag" / "retriever.py"
    spec = importlib.util.spec_from_file_location("_node5_root_rag_retriever", retriever_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"retriever.py를 찾을 수 없습니다: {retriever_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# ── Tool 3: 지역 우선공급 확인 ───────────────────────────────────

@tool
def check_regional_priority(
    user_region: str,
    announcement_region: str,
) -> dict:
    """
    사용자 거주지역과 청약 대상 건설지역을 비교해 지역 우선공급 여부를 확인합니다.

    Args:
        user_region: 사용자 거주지역 (예: "서울")
        announcement_region: 청약 대상 건설지역 (예: "서울 강남구")

    Returns:
        dict: {
            "found": 정보 검색 성공 여부,
            "answer": 우선공급 관련 분석 답변,
            "sources": 참고 출처 목록,
            "is_same_region": 거주지역과 건설지역 일치 여부,
        }
    """
    query = (
        f"{announcement_region}에서 분양하는 주택의 해당지역 거주자 "
        f"우선공급 기준이 뭐야? 거주지역 {user_region} 거주자가 "
        f"1순위로 우선 공급받을 수 있어?"
    )

    system_prompt = (
        "당신은 대한민국 주택 청약 제도 전문가입니다. "
        "지역 우선공급 기준에 대해 사용자의 거주지역과 청약 대상 지역을 비교해 "
        "구체적으로 설명해주세요."
    )

    result = _rag_answer(query, system_prompt)

    # 거주지역과 건설지역이 같은 광역시/도인지 간단히 판단
    is_same_region = user_region.split()[0] in announcement_region

    return {
        **result,
        "user_region": user_region,
        "announcement_region": announcement_region,
        "is_same_region": is_same_region,
    }


# ── Tool 7: 청약 시점 적합성 분석 ────────────────────────────────

@tool
def analyze_subscription_timing(
    bankbook_type: str,
    bankbook_payments: int,
    bankbook_join_date: str,
    is_regulated: bool,
    supply_type: str,
) -> dict:
    """
    청약통장 정보와 공고 조건을 바탕으로 현재 청약 시점이 적합한지 분석합니다.

    Args:
        bankbook_type: 청약통장 종류 (예: "주택청약종합저축")
        bankbook_payments: 납입 횟수
        bankbook_join_date: 가입일 (예: "2020-01-01")
        is_regulated: 규제지역 여부
        supply_type: 공급 유형 ("민간" | "공공")

    Returns:
        dict: {
            "found": 정보 검색 성공 여부,
            "answer": 청약 시점 분석 답변,
            "sources": 참고 출처 목록,
            "is_ready": 1순위 자격 충족 여부 (간단 판단),
            "joined_months": 실제 계산된 가입 기간(개월),
        }
    """
    joined_months = _calculate_joined_months(bankbook_join_date)

    area_type = "투기과열지구" if is_regulated else "일반지역"

    joined_months_text = (
        f"가입 후 {joined_months}개월 경과"
        if joined_months is not None
        else "가입일 정보 확인 불가"
    )

    query = (
        f"{bankbook_type} {joined_months_text}, 납입 횟수 {bankbook_payments}회일 때 "
        f"{area_type} {supply_type}주택 청약 1순위 자격이 되는지? "
        f"가입기간 및 납입 횟수 요건을 알려줘."
    )

    system_prompt = (
        "당신은 대한민국 주택 청약 제도 전문가입니다. "
        "아래에 제시된 가입 기간(개월)과 납입 횟수, 지역 규제 여부는 이미 정확하게 계산된 사실입니다. "
        "이 숫자를 임의로 다시 추정하거나 다른 값으로 바꾸지 말고, 그대로 사용해 "
        "현재 청약 신청이 가능한지, 1순위 자격을 갖췄는지 분석해주세요."
    )

    result = _rag_answer(query, system_prompt)

    # 가입기간(개월) 기준 1순위 자격 판단 (규제지역 24개월, 비규제 6개월 기준)
    required_months = 24 if is_regulated else 6
    is_ready = (
        joined_months is not None
        and joined_months >= required_months
        and bankbook_payments >= required_months
    )

    return {
        **result,
        "bankbook_type": bankbook_type,
        "bankbook_payments": bankbook_payments,
        "joined_months": joined_months,
        "required_months": required_months,
        "is_ready": is_ready,
    }


def _calculate_joined_months(join_date_str: str) -> int | None:
    """가입일 문자열을 받아 오늘까지의 경과 개월 수를 계산합니다."""
    try:
        join_date = date.fromisoformat(str(join_date_str))
    except (ValueError, TypeError):
        return None

    today = date.today()
    months = (today.year - join_date.year) * 12 + (today.month - join_date.month)
    if today.day < join_date.day:
        months -= 1
    return max(months, 0)
