"""
Node 5: 전략 추론 노드

실행 순서:
1. 순서 고정 실행: 대출 계산 → 실투자금 계산 → 자금 리스크 분석 → 지역 우선공급 확인
2. 전략 도구 직접 호출(compare_supply_strategy, calculate_winning_probability,
   analyze_subscription_timing) 후, 결과를 종합하는 LLM 호출 1회로 문장 생성
   (예전에는 create_react_agent로 이 3개 도구 호출까지 LLM이 매번 판단하게 했으나,
   호출 순서/인자가 이미 고정되어 있어 ReAct 루프의 LLM 왕복이 불필요한 지연만
   유발했음.)
3. 결과를 State에 저장 후 반환

사용법:
    python node5_strategy.py
"""

import os
from typing import TypedDict
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

from src.engine.tools.rag_tools import check_regional_priority, analyze_subscription_timing
from src.engine.tools.financial import (
    calculate_loan_amount,
    calculate_real_investment,
    analyze_financial_risk,
)
from src.engine.tools.probability_tools import calculate_winning_probability
from src.engine.tools.strategy_tools import compare_supply_strategy
from src.engine.llm_safety import LLMCallError, safe_llm_call

load_dotenv()

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)


def _format_percent(value) -> str:
    """Return a percent label for numeric ratios without failing on unknown values."""
    if isinstance(value, (int, float)):
        return f"{value:.0%}"
    return "계산 불가"


def _format_won(value) -> str:
    """Return a formatted won label without failing on None (계산 불가 케이스)."""
    if isinstance(value, (int, float)):
        return f"{value:,.0f}원"
    return "계산 불가"


# ── State 정의 ────────────────────────────────────────────────────

class Node5State(TypedDict, total=False):
    # Node 1~2에서 넘어오는 것
    available_supply_types: list[str]
    supply_analysis: dict  
    recommended_supply: str

    # 프론트에서 받은 profile
    profile: dict

    # Node 4에서 넘어오는 것
    announcement: dict

    # Node 5에서 생성되는 결과
    loan_result: dict
    investment_result: dict
    risk_result: dict
    agent_result: str

# ── Node 5 메인 함수 ──────────────────────────────────────────────

def run_node5(state: Node5State) -> Node5State:
    profile = state.get("profile", {})
    announcement = state.get("announcement", {})
    recommended_supply = state.get("recommended_supply", "")
    available_supply_types = state.get("available_supply_types", [])
    supply_analysis = state.get("supply_analysis", {})

    price = announcement.get("price", 0)
    is_regulated = announcement.get("is_regulated", False)
    total_assets = profile.get("total_assets", 0)

    # ── STEP 1: 순서 고정 실행 ────────────────────────────────────
    print("[Node 5] STEP 1: 재무 계산 시작")

    # 1) 대출 가능 금액
    # 생애최초 여부는 공급 유형이 아닌 주택 소유 이력(has_property_history) 기준으로 판정.
    # region은 수도권 한도 캡 판정용이므로 거주지가 아닌 공고(주택 소재지) 지역을 넘긴다.
    loan_result = calculate_loan_amount.invoke({
        "price": price,
        "is_regulated": is_regulated,
        "has_property_history": profile.get("has_property_history"),
        "region": announcement.get("region") or "",
        "average_monthly_income": profile.get("average_monthly_income"),
    })
    print(
        f"  대출 가능 금액: {_format_won(loan_result['loan_amount'])} "
        f"(LTV {_format_percent(loan_result['ltv_rate'])}, "
        f"적용 제약: {loan_result.get('applied_constraint') or '없음'})"
    )

    # 2) 실투자금
    investment_result = calculate_real_investment.invoke({
        "price": price,
        "loan_amount": loan_result["loan_amount"],
    })
    print(f"  실투자금: {_format_won(investment_result['real_investment'])}")

    # 6) 자금 리스크
    risk_result = analyze_financial_risk.invoke({
        "real_investment": investment_result["real_investment"],
        "total_assets": total_assets,
    })
    print(
        f"  자금 리스크: {risk_result['risk_level']} "
        f"(비율 {_format_percent(risk_result.get('ratio'))})"
    )

    # 3) 지역 우선공급 여부 (당첨확률 계산에 쓰이므로 Agent 호출 전에 고정 실행)
    # check_regional_priority 내부의 RAG 답변 생성(LLM)이 실패해도
    # rag_tools._rag_answer가 이미 found=False로 감싸서 반환하지만,
    # 그 외 예기치 못한 예외(도구 자체 버그 등)까지 대비해 한 번 더 감싸둠.
    try:
        regional_result = check_regional_priority.invoke({
            "user_region": profile.get("region"),
            "announcement_region": announcement.get("region"),
        })
    except Exception as exc:
        print(f"[node5] check_regional_priority 도구 호출 실패, 폴백 처리: {exc}")
        user_region = profile.get("region") or ""
        announcement_region = announcement.get("region") or ""
        is_same_region = bool(user_region) and user_region.split()[0] in announcement_region
        regional_result = {
            "found": False,
            "answer": "지역 우선공급 분석 중 오류가 발생해 단순 지역명 비교 결과만 제공합니다.",
            "sources": [],
            "user_region": user_region,
            "announcement_region": announcement_region,
            "is_same_region": is_same_region,
        }
    print(
        f"  지역 우선공급: "
        f"{'해당지역 거주자' if regional_result.get('is_same_region') else '비거주자'}"
    )

    # ── STEP 2: 전략 도구 직접 호출 + 단일 LLM 종합 ────────────────
    # 기존에는 create_react_agent로 이 3개 도구를 LLM이 스스로 판단해서 순서대로
    # 호출하게 했었음. 그런데 실제로는 어떤 도구를, 어떤 인자로, 어떤 순서로 부를지가
    # 위 프롬프트에 이미 전부 고정되어 있어서 LLM이 "판단"할 게 없었고, ReAct 루프라서
    # 도구 하나당 LLM 왕복이 한 번씩 더 걸렸음(최종 응답까지 합치면 4~5회 왕복).
    # 여기서는 도구를 코드에서 직접 호출(즉시 실행, 네트워크 왕복 없음)하고,
    # 결과를 종합해서 문장으로 정리하는 LLM 호출을 딱 1번만 수행해서
    # 전체 요청의 지연시간을 크게 줄인다.
    print("\n[Node 5] STEP 2: 전략 도구 직접 호출")

    # recommended_supply와 실제로 일치하는 항목을 찾아서 사용
    matched_supply = next(
        (
            s for s in supply_analysis.get("available_supplies", [])
            if s.get("type") == recommended_supply
        ),
        {},
    )

    eligibility_gap_items = matched_supply.get("missing_items") or []
    if eligibility_gap_items:
        eligibility_rule = (
            f"추천 공급 유형({recommended_supply})의 신청 자격(특공/일반공급 조건)은 아직 확정되지 않았습니다 "
            f"(미확인 항목: {', '.join(eligibility_gap_items)}). "
            "결론에서 \"자격 자체는 충분하다\"라는 표현을 절대 사용하지 말고, "
            "위 미확인 항목을 먼저 확인해야 한다는 점을 자금 관련 내용보다 먼저 명시하세요."
        )
    else:
        eligibility_rule = (
            f"추천 공급 유형({recommended_supply})의 신청 자격(특공/일반공급 조건)은 "
            "입력 정보 기준으로 충족한 것으로 분석되었습니다."
        )

    action_items = risk_result.get("action_items") or []
    action_items_text = "\n".join(f"  - {item}" for item in action_items) if action_items else "  - 없음"

    # 재무 계산 관련 고지 문구 (한도 캡/DSR/정보 누락 등)
    loan_notices = loan_result.get("notices") or []
    loan_notices_text = (
        "\n".join(f"  - {n}" for n in loan_notices) if loan_notices else "  - 없음"
    )
    price_text = _format_won(price if isinstance(price, (int, float)) and price > 0 else None)

    result_patch: dict = {}
    tools_failed = False

    try:
        compare_result = compare_supply_strategy.invoke({
            "available_supplies": supply_analysis.get("available_supplies", []),
            "general_supply_score": supply_analysis.get("general_supply_score", 0),
            "general_max_score": supply_analysis.get("general_max_score", 0),
            "recommended_supply": recommended_supply,
        })

        probability_result = calculate_winning_probability.invoke({
            "supply_type": recommended_supply,
            "score": matched_supply.get("score"),
            "max_score": matched_supply.get("max_score"),
            "method": matched_supply.get("method", "추첨제"),
            "supply_count": announcement.get("supply_count") or 0,
            "region": announcement.get("region") or "",
            "area": announcement.get("area") or "",
            "recommended_supply": recommended_supply,
            "is_same_region": regional_result.get("is_same_region"),
        })

        # analyze_subscription_timing 내부의 RAG 답변 생성 LLM 호출은
        # rag_tools._rag_answer가 이미 안전하게 감싸고 있음(Fix 2에서 처리).
        timing_result = analyze_subscription_timing.invoke({
            "bankbook_type": profile.get("bankbook_type"),
            "bankbook_payments": profile.get("bankbook_payments"),
            "bankbook_join_date": profile.get("bankbook_join_date"),
            "is_regulated": announcement.get("is_regulated", False),
            "supply_type": announcement.get("supply_type", "미정"),
        })
    except Exception as exc:
        print(f"[node5] 전략 도구 직접 호출 실패, 폴백 처리: {exc}")
        tools_failed = True
        compare_result, probability_result, timing_result = {}, {}, {}

    if tools_failed:
        agent_result = _build_fallback_agent_result(
            recommended_supply=recommended_supply,
            loan_result=loan_result,
            investment_result=investment_result,
            risk_result=risk_result,
            regional_result=regional_result,
        )
        result_patch["node5_agent_warning"] = (
            "전략 분석 도구 실행에 실패해, 사전에 계산된 재무 분석 결과를 바탕으로 한 "
            "요약만 제공합니다. 잠시 후 다시 시도하면 상세 전략 설명을 받을 수 있습니다."
        )
    else:
        reasons_text = "\n".join(f"  - {r}" for r in probability_result.get("reasons", [])) or "  - 없음"
        secondary = compare_result.get("secondary")
        secondary_text = (
            f"{secondary['type']} — {secondary['reason']}" if secondary else "없음"
        )

        # 1순위 자격 충족/미충족에 따라 결론 문장의 예시를 다르게 줘야 한다.
        # 예시를 "미충족" 케이스 하나만 주면, 실제로는 충족한 경우에도 LLM이 같은 문장
        # 구조("-으나")를 그대로 따라 써서 "가능하나...충족했습니다"처럼 앞뒤가 맞지 않는
        # 문장이 나온다(역접 연결어 뒤에 긍정적 결과가 오는 모순).
        if timing_result.get("is_ready"):
            timing_rule = (
                "1순위 자격은 이미 충족한 상태입니다. 결론에서 이를 "
                "\"청약 신청이 가능하며, 1순위 자격(가입기간/납입횟수)도 이미 충족했습니다\"처럼 "
                "역접 연결어(-으나/-지만) 없이 자연스럽게 이어지는 문장으로 쓰세요. "
                "충족된 사실 뒤에 \"아직 충족하지 못했다\" 같은 부정적 표현을 붙이지 마세요."
            )
        else:
            timing_rule = (
                "1순위 자격은 아직 충족하지 못한 상태입니다. 결론에서 이를 "
                "\"청약 신청은 가능하나, 1순위 자격(가입기간/납입횟수)은 아직 충족하지 못했습니다\"처럼 "
                "역접 연결어(-으나)로 이어서 명확히 안내하세요."
            )

        synthesis_prompt = f"""
다음은 이미 계산이 끝난 청약 전략 분석 결과입니다. 이 결과를 사용자에게 설명하는
문장으로 정리해주세요. 숫자를 새로 계산하거나 다른 값으로 바꾸지 말고, 아래 데이터를
그대로 사용하세요.

[사용자 정보]
- 거주지역: {profile.get('region')}
- 무주택 기간: {profile.get('homeless_period_years')}년
- 청약통장 납입 횟수: {profile.get('bankbook_payments')}회
- 월평균 소득: {profile.get('average_monthly_income', '미입력')}원

[공고 정보]
- 건설지역: {announcement.get('region')}
- 공급유형: {announcement.get('supply_type')}
- 분양가: {price_text}
- 희망 평형: {announcement.get('area')}
- 공급 세대수: {announcement.get('supply_count')}세대

[재무 분석 결과 (사전 계산됨, 다시 계산하지 마세요)]
- 대출 가능 금액: {_format_won(loan_result['loan_amount'])} (LTV {_format_percent(loan_result['ltv_rate'])}, {loan_result['area_type']}, 적용 제약: {loan_result.get('applied_constraint') or '확인 불가'})
- 실투자금: {_format_won(investment_result['real_investment'])}
- 자금 리스크: {risk_result['risk_level']} ({risk_result['description']})
- 대출 관련 유의사항 (사전 계산됨, 아래 문구를 재무 설명 마지막에 그대로 포함하세요):
{loan_notices_text}
- 자금 관련 행동지침 (사전 계산됨):
{action_items_text}

[지역 우선공급 분석 결과 (사전 계산됨, 다시 계산하지 마세요)]
- 거주지역 일치 여부: {"일치" if regional_result.get('is_same_region') else "불일치"}
- 분석 내용: {regional_result.get('answer')}
- 위 내용을 그대로 "지역 우선공급 여부" 섹션에 정리해서 보여주세요.

[전략 비교 결과 (사전 계산됨, 다시 계산하지 마세요)]
- 1순위 추천: {compare_result.get('primary', {}).get('type')} — {compare_result.get('primary', {}).get('reason')}
- 2순위 추천: {secondary_text}
- 전략 요약: {compare_result.get('strategy_summary')}

[당첨 경쟁력 분석 결과 (사전 계산됨, 다시 계산하지 마세요)]
- 참고용 경쟁력 지표: {probability_result.get('probability')}
- 판단 근거:
{reasons_text}
- methodology_notice: {probability_result.get('methodology_notice')}

[청약 시점(1순위 자격) 분석 결과 (사전 계산됨, 다시 계산하지 마세요)]
- 분석 내용: {timing_result.get('answer')}
- 1순위 자격 충족 여부: {"충족" if timing_result.get('is_ready') else "미충족"}
- 가입 기간: {timing_result.get('joined_months')}개월 (필요: {timing_result.get('required_months')}개월)

[추천 공급 유형]
- 추천: {recommended_supply}
- 가능 유형: {', '.join(available_supply_types)}

[당첨 확률 표시 규칙]
- winning_score나 breakdown 숫자는 절대 노출하지 마세요.
- "당첨 가능성"이라는 단정적 표현을 쓰지 말고, 반드시 "참고용 경쟁력 지표"라는 표현을 사용하세요.
- 다음 형식으로만 작성하세요.
  참고용 경쟁력 지표: (위 probability 값을 그대로 적으세요, 예: 상/중/하)
  판단 근거:
  - (위 판단 근거 각 줄을 하나씩 불릿으로, 문구를 바꾸지 말고 그대로)
- 위 methodology_notice 내용을 이 섹션 바로 아래에 반드시 별도 문단으로 포함하세요. 생략하거나 요약하지 말고 그대로 전달하세요.

[자격 확정 여부]
- {eligibility_rule}

[결론 작성 규칙]
- "신청 자격"(특공/일반공급 조건, 위 [자격 확정 여부] 내용)과 "1순위 자격"(위 [청약 시점(1순위 자격) 분석 결과] 기준)은 서로 다른 개념입니다. 두 자격을 같은 단어("자격")로 섞어 쓰지 말고, 동사를 다르게 써서 명확히 구분하세요. "자격은 충족했으나 자격은 충족하지 못했다"처럼 같은 단어가 반복되는 문장은 절대 쓰지 마세요.
- {timing_rule}
- 위 [자격 확정 여부]에서 신청 자격이 미확정이라고 했다면, 결론 첫 문장은 반드시 미확인 항목 확인을 우선 안내하고, 그 다음 1순위 자격, 자금 관련 내용을 순서대로 이어서 작성하세요. 이 경우 "자격 자체는 충분하다"는 표현을 절대 사용하지 마세요.
- 아래 자금 리스크별 규칙은 자격 언급 없이 자금 측면만 다루세요. 자격에 대한 언급은 위 [자격 확정 여부] 문장과 1순위 자격 구분 규칙에서만 하세요.
  - 자금 리스크가 "높음"인 경우, "적극적으로 청약에 참여하라"는 식의 권고를 절대 사용하지 마세요.
    대신 "실투자금 대비 자금 부담이 크므로 중도금 대출이나 추가 자금 조달 계획을 사전에 점검해야 한다"는 방향으로 작성하세요.
  - 자금 리스크가 "중간"인 경우, "자금 여유가 제한적이니 비상 자금을 확보해두는 것을 권장한다"는 균형 잡힌 결론을 작성하세요.
  - 자금 리스크가 "낮음"인 경우에만 "적극적으로 참여하라"는 권고를 사용하세요.
  - 자금 리스크가 "분석 불가"인 경우, 자금에 대한 판단(부담이 크다/적다)을 하지 말고,
    분양가 등 누락된 정보를 확인한 뒤 다시 분석해야 한다는 점만 안내하세요.
- 결론은 반드시 위에서 제시된 자금 리스크 수준({risk_result['risk_level']})과 [자격 확정 여부], 1순위 자격 분석 결과 모두와 논리적으로 일치해야 합니다.
- 결론 문단이 끝난 뒤, "다음 행동" 섹션을 별도로 만들고 위 [재무 분석 결과]의 "자금 관련 행동지침"을 각각 불릿으로 그대로 나열하세요. 행동지침의 문구를 바꾸거나 요약하지 말고 그대로 전달하세요.
"""

        try:
            agent_result = safe_llm_call(
                lambda: llm.invoke(synthesis_prompt).content,
                node_name="node5_synthesis",
            )
            print("  전략 종합 완료")
        except LLMCallError as exc:
            # 도구 호출(계산)은 이미 다 성공했는데 마지막 종합 LLM 호출만 실패한 경우.
            # STEP1 재무 결과로 만든 대체 요약을 사용.
            print(f"[node5] {exc}")
            agent_result = _build_fallback_agent_result(
                recommended_supply=recommended_supply,
                loan_result=loan_result,
                investment_result=investment_result,
                risk_result=risk_result,
                regional_result=regional_result,
            )
            result_patch["node5_agent_warning"] = (
                "AI 전략 분석 생성에 일시적으로 실패해, 사전에 계산된 재무 분석 결과를 "
                "바탕으로 한 요약만 제공합니다. 잠시 후 다시 시도하면 상세 전략 설명을 받을 수 있습니다."
            )

    # ── STEP 3: State 업데이트 ────────────────────────────────────
    return {
        **state,
        **result_patch,
        "loan_result": loan_result,
        "investment_result": investment_result,
        "risk_result": risk_result,
        "agent_result": agent_result,
    }


def _build_fallback_agent_result(
    *,
    recommended_supply: str,
    loan_result: dict,
    investment_result: dict,
    risk_result: dict,
    regional_result: dict,
) -> str:
    """agent.invoke()가 끝내 실패했을 때, LLM 없이 STEP1 계산 결과만으로 만드는 대체 요약."""
    ltv_rate = loan_result.get("ltv_rate")
    ltv_text = f"{ltv_rate:.0%}" if isinstance(ltv_rate, (int, float)) else "확인 불가"

    lines = [
        "[참고] AI 전략 분석 생성에 실패하여, 사전에 계산된 재무 분석 결과만 안내드립니다.",
        f"- 추천 공급 유형: {recommended_supply or '확인 불가'}",
        f"- 대출 가능 금액: {_format_won(loan_result.get('loan_amount'))} (LTV {ltv_text})",
        f"- 실투자금: {_format_won(investment_result.get('real_investment'))}",
        f"- 자금 리스크: {risk_result.get('risk_level', '확인 불가')} "
        f"({risk_result.get('description', '상세 설명 없음')})",
        f"- 지역 우선공급: "
        f"{'해당지역 거주자' if regional_result.get('is_same_region') else '비거주자'}",
        "잠시 후 다시 시도하시면 AI가 생성하는 상세 전략 설명을 받아보실 수 있습니다.",
    ]
    return "\n".join(lines)


# ── 테스트 실행 ───────────────────────────────────────────────────

if __name__ == "__main__":
    test_state: Node5State = {
        "supply_analysis": {
        "available_supplies": [
            {"type": "신혼부부 특공", "score": 10, "max_score": 13, "method": "가점제"},
            {"type": "생애최초 특공", "score": None, "max_score": None, "method": "추첨제"},
        ],
        "general_supply_score": 42,
        "general_max_score": 84,
        },
        "available_supply_types": ["신혼부부 특공", "생애최초 특공"],
        "recommended_supply": "신혼부부 특공",
        "profile": {
            "region": "서울",
            "is_homeless": True,
            "homeless_period_years": 3,
            "is_household_head": True,
            "num_household_members": 3,
            "bankbook_type": "주택청약종합저축",
            "bankbook_payments": 24,
            "bankbook_balance": 10000000,
            "bankbook_join_date": "2020-01-01",
            "average_monthly_income": 5000000,
            "total_assets": 100000000,
            "has_property_history": False,
            "birth_year": 1990,
        },
        "announcement": {
            "region": "서울 강남구",
            "is_regulated": True,
            "supply_type": "민간",
            "price": 500000000,
            "deposit": None,
            "area": "84㎡",
            "supply_count": 80,
        },
    }

    result = run_node5(test_state)

    print("\n" + "=" * 60)
    print("Node 5 최종 결과")
    print("=" * 60)
    print(f"\n[대출 결과]\n{result['loan_result']}")
    print(f"\n[실투자금 결과]\n{result['investment_result']}")
    print(f"\n[리스크 결과]\n{result['risk_result']}")
    print(f"\n[Agent 분석]\n{result['agent_result']}")
