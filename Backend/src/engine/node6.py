"""Node 6: 최종 리포트 생성 노드

simulate 여부에 따라 두 가지 리포트를 생성합니다.
- simulate: False → 간단 리포트 (Node 2 결과 기반, GPT 정리)
- simulate: True  → 상세 리포트 (Node 5 결과 포함, agent_result 활용)
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from src.engine.llm_safety import LLMCallError, safe_llm_call

llm = ChatOpenAI(model="gpt-5.4-nano", temperature=0)

# ── 간단 리포트 GPT 프롬프트 ──────────────────────────────────────

SIMPLE_REPORT_PROMPT = ChatPromptTemplate.from_template(
    """당신은 대한민국 주택 청약 전문가입니다.
아래 사용자의 청약 조건 분석 결과를 바탕으로 간결하고 친절한 리포트를 작성해주세요.

규칙:
- 마크다운 헤더(#, ##)는 사용하지 마세요. ###부터만 허용합니다.
- 핵심 정보만 간결하게 전달하세요.
- 추가 질문을 유도하는 멘트는 넣지 마세요.
- 3~5문장으로 요약해주세요.

[분석 결과]
- 추천 특공: {recommended_supply}
- 특공 순위:
{supply_rank_text}
- 사용자 거주지역: {region}
- 무주택 기간: {homeless_period_years}년
- 청약통장 납입 횟수: {bankbook_payments}회
분석 결과도 함께 도출되게 해주세요.
위 정보를 바탕으로 사용자에게 맞춤형 청약 전략을 간결하게 안내해주세요."""
)

_simple_report_chain = SIMPLE_REPORT_PROMPT | llm | StrOutputParser()


def run_node6(state: Mapping[str, Any]) -> dict[str, Any]:
    """
    State에서 simulate 여부를 확인하고 리포트를 생성합니다.
    """
    wants_detailed = state.get("wants_detailed_diagnosis", "아니오")
    is_detailed = wants_detailed in {"예", "yes", True, "true"}

    if is_detailed:
        report = _build_detailed_report(state)
    else:
        report = _build_simple_report(state)

    return {
        "final_report": report,
    }


def _build_simple_report(state: Mapping[str, Any]) -> dict[str, Any]:
    """
    Node 2 결과 기반 간단 리포트
    GPT로 자연스러운 요약 텍스트 생성
    """
    supply_rank = state.get("supply_rank", [])
    profile = state.get("profile", {})

    # 특공 순위 텍스트 생성
    supply_rank_text = "\n".join([
        f"  {item['rank']}순위: {item['type']}"
        + (f" ({item['ratio']})" if item.get("ratio") else "")
        + f" - {item.get('reason', '')}"
        for item in supply_rank
    ])

    recommended_supply = state.get("recommended_supply", "일반공급")
    warning = None

    try:
        # GPT로 요약 생성
        summary = safe_llm_call(
            lambda: _simple_report_chain.invoke({
                "recommended_supply": recommended_supply,
                "supply_rank_text": supply_rank_text,
                "region": profile.get("region", ""),
                "homeless_period_years": profile.get("homeless_period_years", ""),
                "bankbook_payments": profile.get("bankbook_payments", ""),
            }),
            node_name="node6_simple_report",
        )
    except LLMCallError as exc:
        print(f"[node6] {exc}")
        summary = _build_fallback_simple_summary(recommended_supply, supply_rank)
        warning = (
            "AI 요약 생성에 실패해 원본 분석 데이터로만 구성된 결과를 보여드립니다. "
            "잠시 후 다시 시도하면 자연어 요약을 받아볼 수 있습니다."
        )

    report = {
        "report_type": "simple",
        "recommended_supply": recommended_supply,
        "supply_rank": supply_rank,
        "summary": summary,
    }
    if warning:
        report["warning"] = warning
    return report


def _build_fallback_simple_summary(recommended_supply: str, supply_rank: list) -> str:
    """GPT 요약 생성이 실패했을 때 원본 데이터만으로 구성하는 대체 요약(비-LLM)."""
    if not supply_rank:
        rank_text = "확인된 특별공급 순위 정보가 없습니다."
    else:
        rank_text = " / ".join(
            f"{item.get('rank', '?')}순위: {item.get('type', '확인 불가')}"
            for item in supply_rank
        )

    return (
        f"[참고] AI 요약 생성에 실패해 원본 데이터만 안내드립니다.\n"
        f"추천 공급 유형: {recommended_supply}\n"
        f"특공 순위: {rank_text}"
    )


def _build_detailed_report(state: Mapping[str, Any]) -> dict[str, Any]:
    """
    Node 5 결과 포함 상세 리포트
    agent_result를 그대로 활용
    """
    loan_result = state.get("loan_result", {})
    investment_result = state.get("investment_result", {})
    risk_result = state.get("risk_result", {})

    return {
        "report_type": "detailed",
        "recommended_supply": state.get("recommended_supply", "일반공급"),
        "supply_rank": state.get("supply_rank", []),
        "announcement": state.get("announcement", {}),
        "finance": {
            "loan_amount": loan_result.get("loan_amount"),
            "ltv_rate": loan_result.get("ltv_rate"),
            "area_type": loan_result.get("area_type"),
            "real_investment": investment_result.get("real_investment"),
            "price": investment_result.get("price"),
            "risk_level": risk_result.get("risk_level"),
            "risk_ratio": risk_result.get("ratio"),
            "risk_description": risk_result.get("description"),
        },
        "strategy": state.get("agent_result", ""),
    }
