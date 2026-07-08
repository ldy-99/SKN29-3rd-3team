"""
Node 5 재무 계산 툴
- calculate_loan_amount: 대출 가능 금액 계산 (LTV + 절대 한도 캡 + DSR 근사)
- calculate_real_investment: 실투자금 계산
- analyze_financial_risk: 자금 리스크 분석

주의: LTV/한도 기준은 정책에 따라 수시로 바뀌므로 아래 상수를 항상 최신으로 유지할 것.
현재 값은 2025년 6·27 / 10·15 대책 반영 기준.
"""

from typing import Optional

from langchain_core.tools import tool

# ── LTV 기준표 (2025.10·15 대책 반영) ─────────────────────────────
# "생애최초"는 공급 유형이 아니라 "생애최초 주택구입자" 여부로 판단한다.
# (규제지역 일반 LTV는 70%→40%로 하향됐지만 생애최초 구입자는 70% 유지)

LTV_TABLE = {
    "regulation_area": {
        "first_home": 0.7,
        "general": 0.4,
    },
    "non_regulation_area": {
        "first_home": 0.8,
        "general": 0.7,
    },
}

# ── 주담대 절대 한도 캡 (수도권·규제지역, 주택가격 구간별) ─────────
# 6·27 대책(일괄 6억) → 10·15 대책(가격 구간별 차등)
LOAN_CAP_TIERS = [
    (1_500_000_000, 600_000_000),   # 15억 이하 → 최대 6억
    (2_500_000_000, 400_000_000),   # 15억 초과 ~ 25억 이하 → 최대 4억
    (float("inf"), 200_000_000),    # 25억 초과 → 최대 2억
]

# 수도권 판정 키워드 (한도 캡은 규제지역 + 수도권 전체에 적용)
METRO_REGION_KEYWORDS = ("서울", "경기", "인천")

# ── DSR 근사 계산 파라미터 ────────────────────────────────────────
# 실제 DSR은 기존 부채·금리·스트레스 가산 등에 따라 달라지므로 근사치로만 사용.
DSR_RATIO = 0.4                     # 은행권 DSR 40%
DSR_ASSUMED_ANNUAL_RATE = 0.04      # 가정 금리 (연 4%)
DSR_ASSUMED_MATURITY_YEARS = 30     # 가정 만기 (원리금균등 30년)

LOAN_DISCLAIMER = (
    "실제 대출 한도는 기존 부채, 스트레스 DSR, 금리, 은행 심사 기준에 따라 "
    "달라질 수 있으므로 반드시 금융기관에 사전 확인이 필요합니다."
)


def _is_metro_region(region: str) -> bool:
    """공고 지역 문자열로 수도권 여부 판정"""
    return any(kw in (region or "") for kw in METRO_REGION_KEYWORDS)


def _get_loan_cap(price: int) -> int:
    """주택가격 구간별 주담대 절대 한도"""
    for threshold, cap in LOAN_CAP_TIERS:
        if price <= threshold:
            return cap
    return LOAN_CAP_TIERS[-1][1]


def _get_ltv(is_regulated: bool, is_first_home: bool) -> float:
    """규제지역 여부 + 생애최초 구입자 여부로 LTV 반환"""
    area_key = "regulation_area" if is_regulated else "non_regulation_area"
    supply_key = "first_home" if is_first_home else "general"
    return LTV_TABLE[area_key][supply_key]


def _get_dsr_limit(average_monthly_income: int) -> int:
    """
    DSR 40% 기준 대출 한도 근사치 (원리금균등, 가정 금리/만기 사용).
    다른 부채가 없다고 가정한 상한선이므로 실제 한도는 이보다 낮을 수 있음.
    """
    annual_income = average_monthly_income * 12
    monthly_payment_cap = annual_income * DSR_RATIO / 12
    r = DSR_ASSUMED_ANNUAL_RATE / 12
    n = DSR_ASSUMED_MATURITY_YEARS * 12
    annuity_factor = (1 - (1 + r) ** -n) / r
    return int(monthly_payment_cap * annuity_factor)


# ── Tool 1: 대출 가능 금액 계산 ───────────────────────────────────

@tool
def calculate_loan_amount(
    price: Optional[int],
    is_regulated: bool,
    has_property_history: Optional[bool] = None,
    region: str = "",
    average_monthly_income: Optional[int] = None,
) -> dict:
    """
    분양가, 규제지역 여부, 생애최초 구입자 여부, 소득을 바탕으로
    대출 가능 금액을 계산합니다. LTV 한도, 절대 한도 캡(수도권·규제지역),
    DSR 근사 한도 중 가장 작은 값을 적용합니다.

    Args:
        price: 분양가 (원)
        is_regulated: 규제지역 여부
        has_property_history: 세대의 주택 소유 이력 (False면 생애최초 구입자)
        region: 공고(주택 소재지) 지역명 — 수도권 한도 캡 판정용
        average_monthly_income: 가구 월평균 소득 (원) — DSR 근사용

    Returns:
        dict: {
            "loan_amount": 대출 가능 금액 (원) | None,
            "ltv_rate": 적용된 LTV 비율 | None,
            "area_type": 지역 유형 ("규제지역" | "비규제지역"),
            "supply_type": 차주 유형 ("생애최초" | "일반"),
            "ltv_limit": LTV 기준 한도 (원) | None,
            "loan_cap": 절대 한도 캡 (원) | None (캡 미적용 지역이면 None),
            "dsr_limit": DSR 근사 한도 (원) | None (소득 미입력이면 None),
            "applied_constraint": 실제로 적용된 제약 ("LTV" | "대출한도 상한" | "DSR(근사)") | None,
            "notices": 사용자 고지 문구 목록,
        }
    """
    notices: list[str] = []

    # price 방어: 분양가가 없으면 계산 자체를 하지 않는다 (Fix 4)
    if not isinstance(price, (int, float)) or price <= 0:
        return {
            "loan_amount": None,
            "ltv_rate": None,
            "area_type": "규제지역" if is_regulated else "비규제지역",
            "supply_type": None,
            "ltv_limit": None,
            "loan_cap": None,
            "dsr_limit": None,
            "applied_constraint": None,
            "notices": ["분양가 정보가 없어 대출 가능 금액을 계산할 수 없습니다. 공고의 분양가를 확인해주세요."],
        }

    # 생애최초 판정: 공급 유형이 아니라 주택 소유 이력 기준 (Fix 2)
    first_home = has_property_history is False
    if has_property_history is None:
        notices.append(
            "주택 소유 이력 정보가 확인되지 않아 일반 차주 기준 LTV를 적용했습니다. "
            "생애최초 주택구입자라면 실제 한도가 더 높을 수 있습니다."
        )

    ltv = _get_ltv(is_regulated, first_home)
    ltv_limit = int(price * ltv)

    limits = {"LTV": ltv_limit}

    # 절대 한도 캡: 규제지역 또는 수도권 (Fix 1)
    loan_cap = None
    if is_regulated or _is_metro_region(region):
        loan_cap = _get_loan_cap(int(price))
        limits["대출한도 상한"] = loan_cap

    # DSR 근사 한도 (Fix 3)
    dsr_limit = None
    if isinstance(average_monthly_income, (int, float)) and average_monthly_income > 0:
        dsr_limit = _get_dsr_limit(int(average_monthly_income))
        limits["DSR(근사)"] = dsr_limit
    else:
        notices.append(
            "소득 정보가 없어 DSR 한도를 반영하지 못했습니다. "
            "소득 수준에 따라 실제 대출 한도는 더 낮을 수 있습니다."
        )

    applied_constraint = min(limits, key=limits.get)
    loan_amount = limits[applied_constraint]

    if applied_constraint == "대출한도 상한":
        notices.append(
            f"수도권·규제지역 주담대 한도 상한({loan_cap:,}원)이 적용되어 "
            f"LTV 기준 한도({ltv_limit:,}원)보다 대출 가능 금액이 줄었습니다."
        )
    elif applied_constraint == "DSR(근사)":
        notices.append(
            f"소득 기준 DSR 근사 한도({dsr_limit:,}원)가 LTV 기준 한도({ltv_limit:,}원)보다 "
            "작아 DSR 한도를 적용했습니다."
        )

    notices.append(LOAN_DISCLAIMER)

    return {
        "loan_amount": loan_amount,
        "ltv_rate": ltv,
        "area_type": "규제지역" if is_regulated else "비규제지역",
        "supply_type": "생애최초" if first_home else "일반",
        "ltv_limit": ltv_limit,
        "loan_cap": loan_cap,
        "dsr_limit": dsr_limit,
        "applied_constraint": applied_constraint,
        "notices": notices,
    }


# ── Tool 2: 실투자금 계산 ─────────────────────────────────────────

@tool
def calculate_real_investment(
    price: Optional[int],
    loan_amount: Optional[int],
) -> dict:
    """
    분양가에서 대출 가능 금액을 제외한 실제 투자 필요 금액을 계산합니다.

    Args:
        price: 분양가 (원)
        loan_amount: 대출 가능 금액 (원) — calculate_loan_amount 결과 사용

    Returns:
        dict: {
            "real_investment": 실투자금 (원) | None (계산 불가 시),
            "price": 분양가 (원),
            "loan_amount": 대출 가능 금액 (원) | None,
        }
    """
    if (
        not isinstance(price, (int, float))
        or price <= 0
        or not isinstance(loan_amount, (int, float))
    ):
        return {
            "real_investment": None,
            "price": price,
            "loan_amount": loan_amount,
        }

    real_investment = int(price) - int(loan_amount)

    return {
        "real_investment": real_investment,
        "price": price,
        "loan_amount": loan_amount,
    }


# ── Tool 6: 자금 리스크 분석 ──────────────────────────────────────

@tool
def analyze_financial_risk(
    real_investment: Optional[int],
    total_assets: int,
) -> dict:
    """
    실투자금과 총자산을 비교해 자금 리스크를 분석합니다.

    Args:
        real_investment: 실투자금 (원) — calculate_real_investment 결과 사용
        total_assets: 보유 총자산 (원)

    Returns:
        dict: {
            "risk_level": 리스크 수준 ("낮음" | "중간" | "높음" | "분석 불가"),
            "ratio": 실투자금 / 총자산 비율 (0~1) | None,
            "real_investment": 실투자금 (원) | None,
            "total_assets": 총자산 (원),
            "description": 리스크 설명,
            "action_items": 리스크 수준에 따른 구체적 행동지침 목록,
        }
    """
    # 실투자금 계산 불가(분양가 누락 등) 시: "낮음"으로 오판하지 않도록 별도 처리 (Fix 4)
    if not isinstance(real_investment, (int, float)):
        return {
            "risk_level": "분석 불가",
            "ratio": None,
            "real_investment": None,
            "total_assets": total_assets,
            "description": (
                "분양가 또는 대출 정보가 없어 자금 리스크를 계산할 수 없습니다. "
                "공고의 분양가를 확인한 뒤 다시 분석해주세요."
            ),
            "action_items": [
                "공고문에서 희망 평형의 분양가를 확인해주세요.",
                "분양가 확인 후 다시 분석하면 대출 한도와 자금 리스크를 계산해드립니다.",
            ],
        }

    if total_assets <= 0:
        return {
            "risk_level": "높음",
            "ratio": None,
            "real_investment": real_investment,
            "total_assets": total_assets,
            "description": "총자산 정보가 없어 리스크를 정확히 판단할 수 없습니다. 자금 계획을 신중히 검토하세요.",
            "action_items": [
                "보유 자산(예금, 적금, 투자금, 부동산 등)을 다시 한번 정리해 입력해보세요.",
                "총자산 파악 후 실투자금 대비 자금 부담 수준을 다시 확인하세요.",
            ],
        }

    ratio = real_investment / total_assets

    if ratio < 0.5:
        risk_level = "낮음"
        description = (
            f"실투자금({real_investment:,}원)이 총자산({total_assets:,}원)의 "
            f"{ratio:.0%}로, 자금 부담이 낮은 편입니다."
        )
        action_items = [
            "현재 자금 여력은 충분하지만, 중도금 대출 한도와 금리 조건은 미리 확인해두세요.",
            "잔금 납부 시점의 자금 일정을 미리 정리해두면 좋습니다.",
        ]
    elif ratio < 0.8:
        risk_level = "중간"
        description = (
            f"실투자금({real_investment:,}원)이 총자산({total_assets:,}원)의 "
            f"{ratio:.0%}로, 자금 여유가 제한적입니다. 비상 자금 확보를 권장합니다."
        )
        action_items = [
            "중도금 대출 가능 여부와 한도를 은행에 미리 확인하세요.",
            "잔금 조달 계획을 구체적으로 세워두세요 (예: 추가 저축, 기존 자산 매도 시점 등).",
            "예상치 못한 지출에 대비할 비상 자금을 별도로 확보해두는 것을 권장합니다.",
        ]
    else:
        risk_level = "높음"
        description = (
            f"실투자금({real_investment:,}원)이 총자산({total_assets:,}원)의 "
            f"{ratio:.0%}로, 자금 부담이 매우 높습니다. 추가 자금 조달 계획이 필요합니다."
        )
        action_items = [
            "중도금 대출 가능 여부와 최대 한도를 반드시 사전에 확인하세요.",
            "잔금 조달을 위한 추가 자기자본 확보 방안(저축, 자산 매도, 가족 지원 등)을 구체적으로 검토하세요.",
            "현재 자금 수준으로 부담이 큰 경우, 분양가가 더 낮은 단지나 소형 평형도 함께 비교해보세요.",
        ]

    # 실투자금에는 취득세·옵션비 등 부대비용이 빠져 있음을 항상 고지
    action_items.append(
        "실투자금에는 취득세, 발코니 확장비, 옵션비, 이사 비용 등 부대비용이 포함되어 있지 않으니 "
        "여유 자금을 추가로 고려하세요."
    )

    return {
        "risk_level": risk_level,
        "ratio": round(ratio, 4),
        "real_investment": real_investment,
        "total_assets": total_assets,
        "description": description,
        "action_items": action_items,
    }
