"""Node 4: 공고문 입력 인터럽트 노드

그래프를 일시정지하고 사용자로부터 공고문 정보를 자유 형식으로 입력받아
OpenAI with_structured_output으로 정형 데이터로 변환합니다.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Literal, Optional

from langchain_openai import ChatOpenAI
from langgraph.types import interrupt
from pydantic import BaseModel, Field

from src.engine.llm_safety import LLMCallError, safe_llm_call


# ── 공고문 정형 스키마 ─────────────────────────────────────────────

class AnnouncementSchema(BaseModel):
    """사용자의 자유 입력에서 공고문 필수 데이터를 추출합니다."""

    region: str = Field(
        ...,
        description="단지가 위치한 지역 및 자치구 (예: '서울 강남구', '경기 수원시')"
    )
    is_regulated: bool = Field(
        ...,
        description="투기과열지구, 조정대상지역 등 규제지역이면 True, 비규제지역이면 False"
    )
    supply_type: Literal["민간", "공공", "미정"] = Field(
        ...,
        description="민간분양/민영주택은 '민간', 공공분양/LH/SH/국민주택은 '공공'"
    )
    price: Optional[int] = Field(
        None,
        description=(
            "분양가를 원 단위 정수로 환산 (예: '5억' → 500000000). "
            "'공급금액 범위: 2.2억~6.5억'처럼 범위로 제시된 경우 null로 두지 말고 "
            "더 높은 금액(상한값)을 사용해 보수적으로 계산되게 한다. 정보가 전혀 없으면 null."
        )
    )
    deposit: Optional[int] = Field(
        None,
        description="임대/전세보증금을 원 단위 정수로 환산. 일반 분양이면 null"
    )
    area: str = Field(
        ...,
        description="희망 평형 또는 전용면적 (예: '84㎡', '59㎡', '34평')"
    )
    supply_count: Optional[int] = Field(
        None,
        description="공급 세대수 (예: '80세대' → 80). 없으면 null"
    )


# ── Node 4 메인 함수 ──────────────────────────────────────────────

def run_node4(state: Mapping[str, Any]) -> dict[str, Any]:
    """
    그래프를 일시정지하고 사용자 입력을 기다립니다.
    FastAPI에서 Command(resume=announcement_text)로 재개하면
    자유 텍스트를 정형 데이터로 변환해 State에 저장합니다.
    """
    # 그래프 일시정지 + 프론트 대기 메시지
    user_raw_input: str = interrupt(
        {"prompt": "관심 단지의 지역, 규제여부, 공급유형, 분양가, 평형 정보를 자유롭게 입력해주세요."}
    )

    # 자유 텍스트 → 정형 데이터 변환
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    structured_llm = llm.with_structured_output(AnnouncementSchema, method="function_calling")

    try:
        extracted: AnnouncementSchema = safe_llm_call(
            lambda: structured_llm.invoke(user_raw_input),
            node_name="node4",
        )
        return {
            "announcement": extracted.model_dump(),
        }
    except LLMCallError as exc:
        # 공고문 자동 분석이 실패해도 파이프라인은 계속 진행시킴.
        # 이후 노드는 announcement 값이 비어있는 채로 동작하고(예: price=None),
        # 사용자에게는 node4_warning으로 실패 사실과 재시도 안내를 전달함.
        print(f"[node4] {exc}")
        return {
            "announcement": {
                "region": None,
                "is_regulated": False,
                "supply_type": "미정",
                "price": None,
                "deposit": None,
                "area": None,
                "supply_count": None,
            },
            "node4_warning": (
                "입력하신 공고문 내용을 AI가 자동으로 분석하지 못했습니다. "
                "지역/규제여부/분양가/평형 정보를 조금 더 구체적으로 입력해 다시 시도해주세요. "
                "아래 결과는 공고 정보 없이 계산된 참고용 결과입니다."
            ),
        }