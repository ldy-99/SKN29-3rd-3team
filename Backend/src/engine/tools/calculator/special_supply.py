from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from src.engine.tools.calculator.housing_subscription_score_constants import (
    get_primary_source_ref,
    load_housing_subscription_score_table,
)
from src.engine.tools.calculator.household_income_constants import (
    get_household_income_100_percent,
)
from src.engine.tools.calculator.special_supply_rules import load_special_supply_rules


RESULT_STATUS_POSSIBLE = "가능성 있음"
RESULT_STATUS_NEEDS_REVIEW = "추가 확인 필요"
RESULT_STATUS_UNLIKELY = "가능성 낮음"
ACCURACY_NOTICE = "입력 정보가 부족해 정확한 자격/가점 안내가 어렵습니다."

CalculationType = Literal[
    "POINT_BASED",
    "POINT_BASED_OR_PRIORITY_BASED",
    "CONDITION_OR_LOTTERY_BASED",
    "GENERAL_SCORE_OR_PRIORITY_BASED",
    "PARTIAL_GENERAL_SCORE",
]


class SpecialSupplyInput(BaseModel):
    """Profile-shaped input for deterministic special-supply checks.

    Unknown values must stay as None or UNKNOWN. Calculators must not coerce
    unknowns to false, zero, or an unfavorable answer.
    """

    model_config = ConfigDict(extra="ignore")

    is_homeless: bool | None = None
    is_household_head: bool | None = None
    marital_status: str | None = None
    marriage_period: str | None = None
    marriage_period_years: int | None = Field(default=None, ge=0)
    has_two_or_more_minor_children: bool | None = None
    is_dual_income: bool | None = None
    child_count_group: str | None = None
    youngest_child_age_group: str | None = None
    has_property_history: bool | None = None
    elderly_support: str | None = None

    bankbook_joined_months: int | None = Field(default=None, ge=0)
    bankbook_payments: int | None = Field(default=None, ge=0)
    bankbook_balance: int | None = Field(default=None, ge=0)
    # 저축액(선납금 포함 누적 납입인정액). bankbook_balance(예치금)와는 다른 개념이며
    # 생애최초 특공의 "저축액 600만원 이상" 판정에 사용된다.
    bankbook_savings_amount: int | None = Field(default=None, ge=0)
    homeless_period_years: int | None = Field(default=None, ge=0)
    dependent_family_count: int | None = Field(default=None, ge=0)
    num_household_members: int | None = Field(default=None, ge=1)
    average_monthly_income: int | None = Field(default=None, ge=0)
    total_assets: int | None = Field(default=None, ge=0)

    minor_child_count: int | None = Field(default=None, ge=0)
    young_child_count: int | None = Field(default=None, ge=0)
    residence_period_years: int | None = Field(default=None, ge=0)
    is_three_generation_household: bool | None = None
    is_single_parent_family_5_years: bool | None = None
    has_income_tax_payment_5_years: bool | None = None


class SpecialSupplyResult(BaseModel):
    supply_type: str
    status: str
    calculation_type: CalculationType
    score: int | None = None
    max_score: int | None = None
    matched_item_count: int = 0
    total_item_count: int = 0
    score_breakdown: dict[str, int] = Field(default_factory=dict)
    matched_items: list[str] = Field(default_factory=list)
    missing_items: list[str] = Field(default_factory=list)
    unknown_fields: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    source_refs: list[str] = Field(default_factory=list)
    need_review: bool = False
    accuracy_notice: str | None = None


def calculate_general_supply_profile_score(
    input_data: SpecialSupplyInput | dict[str, Any],
) -> SpecialSupplyResult:
    profile = _coerce_input(input_data)
    table = load_housing_subscription_score_table()
    score_breakdown: dict[str, int] = {}
    matched_items: list[str] = []
    missing_items: list[str] = []
    unknown_fields: list[str] = []

    homeless_score = _score_years_from_rows(
        profile.homeless_period_years,
        table["tables"]["homeless_period"],
        unknown_fields,
        "homeless_period_years",
    )
    if homeless_score is not None:
        score_breakdown["homeless_score"] = homeless_score
        if homeless_score > 0:
            matched_items.append("무주택기간 점수 산출")

    dependent_score = _score_count_from_rows(
        profile.dependent_family_count,
        table["tables"]["dependent_family"],
        unknown_fields,
        "dependent_family_count",
    )
    if dependent_score is not None:
        score_breakdown["dependent_family_score"] = dependent_score
        if dependent_score > 0:
            matched_items.append("부양가족 점수 산출")

    subscription_score = _score_months_from_rows(
        profile.bankbook_joined_months,
        table["tables"]["subscription_period"],
        unknown_fields,
        "bankbook_joined_months",
    )
    if subscription_score is not None:
        score_breakdown["subscription_score"] = subscription_score
        if subscription_score > 0:
            matched_items.append("청약통장 가입기간 점수 산출")

    if profile.is_homeless is False:
        missing_items.append("일반공급 가점제 무주택 기준 확인 필요")

    score = sum(score_breakdown.values()) if score_breakdown else None
    return _build_result(
        supply_type="일반공급 가점제",
        calculation_type="PARTIAL_GENERAL_SCORE",
        source_refs=[get_primary_source_ref()],
        score=score,
        max_score=table["score_limits"]["total"],
        total_item_count=3,
        score_breakdown=score_breakdown,
        matched_items=matched_items,
        missing_items=missing_items,
        unknown_fields=unknown_fields,
    )


def calculate_newlywed_special_supply(
    input_data: SpecialSupplyInput | dict[str, Any],
) -> SpecialSupplyResult:
    profile = _coerce_input(input_data)
    rule = _rule("newlywed")
    score_breakdown: dict[str, int] = {}
    matched_items: list[str] = []
    missing_items: list[str] = []
    unknown_fields: list[str] = []

    if profile.is_homeless is False:
        return _unlikely(rule, "무주택세대구성원으로 입력되지 않았습니다.")
    _check_bool(profile.is_homeless, "is_homeless", "무주택세대구성원", matched_items, unknown_fields)

    family_ok = profile.marital_status in {"MARRIED", "ENGAGED"} or profile.youngest_child_age_group in {
        "UNDER_2",
        "AGE_2_TO_6",
    }
    if family_ok:
        matched_items.append("신혼부부/예비신혼부부/한부모가족 후보")
    elif _unknown(profile.marital_status) and _unknown(profile.youngest_child_age_group):
        unknown_fields.extend(["marital_status", "youngest_child_age_group"])
    else:
        missing_items.append("혼인 또는 6세 이하 자녀 기준")

    _check_minimum(
        profile.bankbook_joined_months,
        6,
        "bankbook_joined_months",
        "청약통장 6개월 이상",
        matched_items,
        missing_items,
        unknown_fields,
    )
    _check_minimum(
        profile.bankbook_payments,
        6,
        "bankbook_payments",
        "납입 6회 이상",
        matched_items,
        missing_items,
        unknown_fields,
    )
    _check_present(profile.average_monthly_income, "average_monthly_income", "가구 월평균 소득 입력", matched_items, unknown_fields)
    _check_present(profile.total_assets, "total_assets", "총자산 입력", matched_items, unknown_fields)

    score_breakdown.update(
        _score_public_family_table(
            profile,
            include_marriage_period=True,
            include_youngest_child_age=True,
            unknown_fields=unknown_fields,
        )
    )
    score = sum(score_breakdown.values()) if score_breakdown else None

    return _build_result(
        supply_type=rule["display_name"],
        calculation_type=rule["calculation_type"],
        source_refs=rule["source_refs"],
        score=score,
        max_score=rule["public_score_table"]["max_score"],
        total_item_count=6,
        score_breakdown=score_breakdown,
        matched_items=matched_items + _matched_score_items(score_breakdown),
        missing_items=missing_items,
        unknown_fields=unknown_fields,
    )


def calculate_multi_child_special_supply(
    input_data: SpecialSupplyInput | dict[str, Any],
) -> SpecialSupplyResult:
    profile = _coerce_input(input_data)
    rule = _rule("multi_child")
    score_breakdown: dict[str, int] = {}
    matched_items: list[str] = []
    missing_items: list[str] = []
    unknown_fields: list[str] = []

    if profile.is_homeless is False:
        return _unlikely(rule, "무주택세대구성원으로 입력되지 않았습니다.")
    _check_bool(profile.is_homeless, "is_homeless", "무주택세대구성원", matched_items, unknown_fields)

    if profile.minor_child_count is not None:
        if profile.minor_child_count < 2:
            return _unlikely(rule, "미성년 자녀 2명 이상으로 입력되지 않았습니다.")
        matched_items.append("미성년 자녀 2명 이상")
    elif profile.has_two_or_more_minor_children is True or profile.child_count_group == "TWO_OR_MORE":
        matched_items.append("미성년 자녀 2명 이상")
        unknown_fields.append("minor_child_count")
    elif profile.has_two_or_more_minor_children is False or profile.child_count_group == "ONE":
        return _unlikely(rule, "미성년 자녀 2명 이상으로 입력되지 않았습니다.")
    else:
        unknown_fields.append("minor_child_count")

    _check_minimum(
        profile.bankbook_joined_months,
        6,
        "bankbook_joined_months",
        "청약통장 6개월 이상",
        matched_items,
        missing_items,
        unknown_fields,
    )
    _check_present(profile.average_monthly_income, "average_monthly_income", "가구 월평균 소득 입력", matched_items, unknown_fields)
    _check_present(profile.total_assets, "total_assets", "총자산 입력", matched_items, unknown_fields)

    score_breakdown.update(_score_multi_child_table(profile, unknown_fields))
    score = sum(score_breakdown.values()) if score_breakdown else None

    return _build_result(
        supply_type=rule["display_name"],
        calculation_type=rule["calculation_type"],
        source_refs=rule["source_refs"],
        score=score,
        max_score=rule["score_table"]["max_score"],
        total_item_count=6,
        score_breakdown=score_breakdown,
        matched_items=matched_items + _matched_score_items(score_breakdown),
        missing_items=missing_items,
        unknown_fields=unknown_fields,
    )


def check_first_home_special_supply(
    input_data: SpecialSupplyInput | dict[str, Any],
) -> SpecialSupplyResult:
    profile = _coerce_input(input_data)
    rule = _rule("first_home")
    matched_items: list[str] = []
    missing_items: list[str] = []
    unknown_fields: list[str] = []

    if profile.is_homeless is False:
        return _unlikely(rule, "무주택세대구성원으로 입력되지 않았습니다.")
    _check_bool(profile.is_homeless, "is_homeless", "무주택세대구성원", matched_items, unknown_fields)

    if profile.has_property_history is True:
        return _unlikely(rule, "과거 주택 구입/소유 이력이 있는 것으로 입력되었습니다.")
    if profile.has_property_history is False:
        matched_items.append("과거 주택 구입/소유 이력 없음")
    else:
        unknown_fields.append("has_property_history")

    _check_minimum(profile.bankbook_payments, 24, "bankbook_payments", "납입 24회 이상", matched_items, missing_items, unknown_fields)
    # 저축액(누적 납입인정액) 우선 사용. 신규 필드가 없는 기존 프로필은 예치금(bankbook_balance)으로 대체 판정한다.
    savings_amount = (
        profile.bankbook_savings_amount
        if profile.bankbook_savings_amount is not None
        else profile.bankbook_balance
    )
    _check_minimum(savings_amount, 6000000, "bankbook_savings_amount", "저축액 600만원 이상", matched_items, missing_items, unknown_fields)
    _check_bool(
        profile.has_income_tax_payment_5_years,
        "has_income_tax_payment_5_years",
        "5년 이상 소득세 납부",
        matched_items,
        unknown_fields,
        missing_items,
    )
    _check_present(profile.average_monthly_income, "average_monthly_income", "가구 월평균 소득 입력", matched_items, unknown_fields)
    _check_present(profile.total_assets, "total_assets", "총자산 입력", matched_items, unknown_fields)

    return _build_result(
        supply_type=rule["display_name"],
        calculation_type=rule["calculation_type"],
        source_refs=rule["source_refs"],
        score=None,
        max_score=None,
        total_item_count=7,
        score_breakdown={},
        matched_items=matched_items,
        missing_items=missing_items,
        unknown_fields=unknown_fields,
    )


def check_newborn_special_supply(
    input_data: SpecialSupplyInput | dict[str, Any],
) -> SpecialSupplyResult:
    profile = _coerce_input(input_data)
    rule = _rule("newborn")
    score_breakdown: dict[str, int] = {}
    matched_items: list[str] = []
    missing_items: list[str] = []
    unknown_fields: list[str] = []

    if profile.is_homeless is False:
        return _unlikely(rule, "무주택세대구성원으로 입력되지 않았습니다.")
    _check_bool(profile.is_homeless, "is_homeless", "무주택세대구성원", matched_items, unknown_fields)

    if profile.youngest_child_age_group == "UNDER_2":
        matched_items.append("2세 미만 자녀")
    elif _unknown(profile.youngest_child_age_group):
        unknown_fields.append("youngest_child_age_group")
    else:
        return _unlikely(rule, "2세 미만 자녀로 입력되지 않았습니다.")

    _check_minimum(profile.bankbook_joined_months, 6, "bankbook_joined_months", "청약통장 6개월 이상", matched_items, missing_items, unknown_fields)
    _check_minimum(profile.bankbook_payments, 6, "bankbook_payments", "납입 6회 이상", matched_items, missing_items, unknown_fields)
    _check_present(profile.average_monthly_income, "average_monthly_income", "가구 월평균 소득 입력", matched_items, unknown_fields)
    _check_present(profile.total_assets, "total_assets", "총자산 입력", matched_items, unknown_fields)

    score_breakdown.update(
        _score_public_family_table(
            profile,
            include_marriage_period=False,
            include_youngest_child_age=False,
            unknown_fields=unknown_fields,
        )
    )
    score = sum(score_breakdown.values()) if score_breakdown else None

    return _build_result(
        supply_type=rule["display_name"],
        calculation_type=rule["calculation_type"],
        source_refs=rule["source_refs"],
        score=score,
        max_score=rule["public_score_table"]["max_score"],
        total_item_count=6,
        score_breakdown=score_breakdown,
        matched_items=matched_items + _matched_score_items(score_breakdown),
        missing_items=missing_items,
        unknown_fields=unknown_fields,
    )


def calculate_elderly_parent_special_supply(
    input_data: SpecialSupplyInput | dict[str, Any],
) -> SpecialSupplyResult:
    profile = _coerce_input(input_data)
    rule = _rule("elderly_parent")
    matched_items: list[str] = []
    missing_items: list[str] = []
    unknown_fields: list[str] = []
    warnings: list[str] = [
        "민영주택 노부모부양은 일반공급 가점제와 연결되지만, 정확한 일반가점 계산에는 생년월일, 부양가족 수, 청약통장 가입일 등 추가 확인이 필요합니다."
    ]

    if profile.is_homeless is False:
        return _unlikely(rule, "무주택세대구성원으로 입력되지 않았습니다.")
    _check_bool(profile.is_homeless, "is_homeless", "무주택세대구성원", matched_items, unknown_fields)

    if profile.is_household_head is False:
        return _unlikely(rule, "세대주로 입력되지 않았습니다.")
    _check_bool(profile.is_household_head, "is_household_head", "세대주", matched_items, unknown_fields)

    if profile.elderly_support == "MEETS_65_AND_3Y":
        matched_items.append("만 65세 이상 직계존속 3년 이상 부양")
    elif _unknown(profile.elderly_support):
        unknown_fields.append("elderly_support")
    else:
        return _unlikely(rule, "노부모 3년 이상 부양 조건을 충족하지 않는 것으로 입력되었습니다.")

    _check_minimum(profile.bankbook_joined_months, 24, "bankbook_joined_months", "청약통장 24개월 이상", matched_items, missing_items, unknown_fields)
    _check_present(profile.average_monthly_income, "average_monthly_income", "공공주택 소득 기준 입력", matched_items, unknown_fields)

    return _build_result(
        supply_type=rule["display_name"],
        calculation_type=rule["calculation_type"],
        source_refs=rule["source_refs"],
        score=None,
        max_score=None,
        total_item_count=5,
        score_breakdown={},
        matched_items=matched_items,
        missing_items=missing_items,
        unknown_fields=unknown_fields,
        warnings=warnings,
    )


def calculate_all_supply_results(
    input_data: SpecialSupplyInput | dict[str, Any],
) -> list[SpecialSupplyResult]:
    profile = _coerce_input(input_data)
    return [
        calculate_general_supply_profile_score(profile),
        calculate_newlywed_special_supply(profile),
        calculate_multi_child_special_supply(profile),
        check_first_home_special_supply(profile),
        check_newborn_special_supply(profile),
        calculate_elderly_parent_special_supply(profile),
    ]


def _coerce_input(input_data: SpecialSupplyInput | dict[str, Any]) -> SpecialSupplyInput:
    if isinstance(input_data, SpecialSupplyInput):
        return input_data
    return SpecialSupplyInput.model_validate(input_data)


def _rule(key: str) -> dict[str, Any]:
    return load_special_supply_rules()["supply_types"][key]


def _build_result(
    *,
    supply_type: str,
    calculation_type: CalculationType,
    source_refs: list[str],
    score: int | None,
    max_score: int | None,
    total_item_count: int,
    score_breakdown: dict[str, int],
    matched_items: list[str],
    missing_items: list[str],
    unknown_fields: list[str],
    warnings: list[str] | None = None,
) -> SpecialSupplyResult:
    unknown_fields = _dedupe(unknown_fields)
    missing_items = _dedupe(missing_items)
    matched_items = _dedupe(matched_items)
    warnings = _dedupe(warnings or [])
    need_review = bool(unknown_fields or missing_items)
    status = RESULT_STATUS_NEEDS_REVIEW if need_review else RESULT_STATUS_POSSIBLE
    return SpecialSupplyResult(
        supply_type=supply_type,
        status=status,
        calculation_type=calculation_type,
        score=score,
        max_score=max_score,
        matched_item_count=len(matched_items),
        total_item_count=total_item_count,
        score_breakdown=score_breakdown,
        matched_items=matched_items,
        missing_items=missing_items,
        unknown_fields=unknown_fields,
        warnings=warnings,
        source_refs=source_refs,
        need_review=need_review,
        accuracy_notice=ACCURACY_NOTICE if need_review else None,
    )


def _unlikely(rule: dict[str, Any], reason: str) -> SpecialSupplyResult:
    return SpecialSupplyResult(
        supply_type=rule["display_name"],
        status=RESULT_STATUS_UNLIKELY,
        calculation_type=rule["calculation_type"],
        score=None,
        max_score=rule.get("score_table", rule.get("public_score_table", {})).get("max_score"),
        matched_item_count=0,
        total_item_count=len(rule.get("eligibility_items", [])),
        missing_items=[reason],
        warnings=[],
        source_refs=rule["source_refs"],
        need_review=False,
        accuracy_notice=None,
    )


def _score_multi_child_table(
    profile: SpecialSupplyInput,
    unknown_fields: list[str],
) -> dict[str, int]:
    scores: dict[str, int] = {}

    child_score = _score_count_value(
        profile.minor_child_count,
        [(4, None, 40), (3, 3, 35), (2, 2, 25)],
        unknown_fields,
        "minor_child_count",
    )
    if child_score is not None:
        scores["minor_child_count"] = child_score

    young_child_score = _score_count_value(
        profile.young_child_count,
        [(3, None, 15), (2, 2, 10), (1, 1, 5), (0, 0, 0)],
        unknown_fields,
        "young_child_count",
    )
    if young_child_score is not None:
        scores["young_child_count"] = young_child_score

    if profile.is_three_generation_household is True or profile.is_single_parent_family_5_years is True:
        scores["household_composition"] = 5
    elif profile.is_three_generation_household is None and profile.is_single_parent_family_5_years is None:
        unknown_fields.append("is_three_generation_household")
    else:
        scores["household_composition"] = 0

    homeless_score = _score_year_value(
        profile.homeless_period_years,
        [(10, None, 20), (5, 10, 15), (1, 5, 10), (0, 1, 0)],
        unknown_fields,
        "homeless_period_years",
    )
    if homeless_score is not None:
        scores["homeless_period_years"] = homeless_score

    residence_score = _score_year_value(
        profile.residence_period_years,
        [(10, None, 15), (5, 10, 10), (1, 5, 5), (0, 1, 0)],
        unknown_fields,
        "residence_period_years",
    )
    if residence_score is not None:
        scores["residence_period_years"] = residence_score

    if profile.bankbook_joined_months is None:
        unknown_fields.append("bankbook_joined_months")
    else:
        scores["bankbook_joined_months"] = 5 if profile.bankbook_joined_months >= 120 else 0

    return scores

def _score_income_bucket(
    profile: SpecialSupplyInput,
    unknown_fields: list[str],
) -> int | None:
    income = profile.average_monthly_income
    members = profile.num_household_members
    is_dual_income = profile.is_dual_income

    if income is None or members is None:
        unknown_fields.append("income_score_bucket")
        return None
    if is_dual_income is None:
        unknown_fields.append("is_dual_income")
        return None

    standard_100 = get_household_income_100_percent(members)
    if standard_100 is None:
        unknown_fields.append("income_score_bucket")
        return None

    threshold = standard_100 if is_dual_income else standard_100 * 0.8
    return 1 if income <= threshold else 0

def _score_public_family_table(
    profile: SpecialSupplyInput,
    *,
    include_marriage_period: bool,
    include_youngest_child_age: bool,
    unknown_fields: list[str],
) -> dict[str, int]:
    scores: dict[str, int] = {}

    income_score = _score_income_bucket(profile, unknown_fields)
    if income_score is not None:
        scores["income"] = income_score

    minor_child_count = profile.minor_child_count
    if minor_child_count is None and profile.child_count_group == "ONE":
        minor_child_count = 1
    child_score = _score_count_value(
        minor_child_count,
        [(3, None, 3), (2, 2, 2), (1, 1, 1), (0, 0, 0)],
        unknown_fields,
        "minor_child_count",
    )
    if child_score is not None:
        scores["minor_child_count"] = child_score

    residence_score = _score_year_value(
        profile.residence_period_years,
        [(3, None, 3), (1, 3, 2), (0, 1, 1)],
        unknown_fields,
        "residence_period_years",
    )
    if residence_score is not None:
        scores["residence_period_years"] = residence_score

    payment_score = _score_count_value(
        profile.bankbook_payments,
        [(24, None, 3), (12, 24, 2), (6, 12, 1)],
        unknown_fields,
        "bankbook_payments",
    )
    if payment_score is not None:
        scores["bankbook_payments"] = payment_score

    if include_marriage_period:
        marriage_years = profile.marriage_period_years
        if marriage_years is None:
            marriage_years = _marriage_period_to_years(profile.marriage_period)
        marriage_score = _score_year_value(
            marriage_years,
            [(0, 3, 3), (3, 5, 2), (5, 7, 1)],
            unknown_fields,
            "marriage_period",
        )
        if marriage_score is not None:
            scores["marriage_period"] = marriage_score

    if include_youngest_child_age and profile.marital_status not in {"MARRIED", "ENGAGED"}:
        age_score = {
            "UNDER_2": 3,
            "AGE_2_TO_6": 2,
            "AGE_7_PLUS_MINOR": 0,
        }.get(profile.youngest_child_age_group)
        if age_score is None:
            unknown_fields.append("youngest_child_age_group")
        else:
            scores["youngest_child_age_group"] = age_score

    return scores


def _marriage_period_to_years(value: str | None) -> int | None:
    if value == "WITHIN_7_YEARS":
        # The exact year is unknown. Use None so the score bucket is not guessed.
        return None
    if value == "OVER_7_YEARS":
        return 8
    return None


def _score_count_from_rows(
    value: int | None,
    rows: list[dict[str, Any]],
    unknown_fields: list[str],
    field_name: str,
) -> int | None:
    if value is None:
        unknown_fields.append(field_name)
        return None
    for row in rows:
        if "count" in row and value == row["count"]:
            return row["score"]
        if "min_count" in row and value >= row["min_count"]:
            return row["score"]
    return 0


def _score_years_from_rows(
    value: int | None,
    rows: list[dict[str, Any]],
    unknown_fields: list[str],
    field_name: str,
) -> int | None:
    if value is None:
        unknown_fields.append(field_name)
        return None
    for row in rows:
        if value >= row["min_years"] and (
            row["max_years"] is None or value < row["max_years"]
        ):
            return row["score"]
    return 0


def _score_months_from_rows(
    value: int | None,
    rows: list[dict[str, Any]],
    unknown_fields: list[str],
    field_name: str,
) -> int | None:
    if value is None:
        unknown_fields.append(field_name)
        return None
    for row in rows:
        if value >= row["min_months"] and (
            row["max_months"] is None or value < row["max_months"]
        ):
            return row["score"]
    return 0


def _score_count_value(
    value: int | None,
    bands: list[tuple[int, int | None, int]],
    unknown_fields: list[str],
    field_name: str,
) -> int | None:
    if value is None:
        unknown_fields.append(field_name)
        return None
    for min_count, max_count, score in bands:
        if value >= min_count and (max_count is None or value <= max_count):
            return score
    return 0


def _score_year_value(
    value: int | None,
    bands: list[tuple[int, int | None, int]],
    unknown_fields: list[str],
    field_name: str,
) -> int | None:
    if value is None:
        unknown_fields.append(field_name)
        return None
    for min_years, max_years, score in bands:
        if value >= min_years and (max_years is None or value < max_years):
            return score
    return 0


def _check_bool(
    value: bool | None,
    field_name: str,
    label: str,
    matched_items: list[str],
    unknown_fields: list[str],
    missing_items: list[str] | None = None,
) -> None:
    if value is True:
        matched_items.append(label)
    elif value is None:
        unknown_fields.append(field_name)
    elif missing_items is not None:
        missing_items.append(label)


def _check_minimum(
    value: int | None,
    threshold: int,
    field_name: str,
    label: str,
    matched_items: list[str],
    missing_items: list[str],
    unknown_fields: list[str],
) -> None:
    if value is None:
        unknown_fields.append(field_name)
    elif value >= threshold:
        matched_items.append(label)
    else:
        missing_items.append(label)


def _check_present(
    value: Any,
    field_name: str,
    label: str,
    matched_items: list[str],
    unknown_fields: list[str],
) -> None:
    if _unknown(value):
        unknown_fields.append(field_name)
    else:
        matched_items.append(label)


def _unknown(value: Any) -> bool:
    return value is None or value == "UNKNOWN"


def _matched_score_items(score_breakdown: dict[str, int]) -> list[str]:
    return [f"{key} 점수 산출" for key, value in score_breakdown.items() if value > 0]


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result
