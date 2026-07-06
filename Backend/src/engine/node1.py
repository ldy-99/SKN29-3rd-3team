"""Node 1 profile qualification.

Node 1 reads the incoming pipeline state and returns the small state patch that
Node 2 needs: available special-supply types and calculator tool inputs.
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import date
from typing import Any


NEWLYWED_SPECIAL = "신혼부부 특공"
MULTI_CHILD_SPECIAL = "다자녀 특공"
FIRST_HOME_SPECIAL = "생애최초 특공"

MARRIED_VALUES = {
    "MARRIED",
    "ENGAGED",
    "married",
    "engaged",
    "기혼",
    "예비신혼",
    "예비신혼부부",
    "신혼",
    "신혼부부",
}
MULTI_CHILD_VALUES = {
    "TWO_OR_MORE",
    "HAS_TWO_OR_MORE",
    "two_or_more",
    "2명 이상",
    "둘 이상",
    "다자녀",
}
NOT_MARRIED_VALUES = {
    "SINGLE",
    "single",
    "미혼",
    "DIVORCED",
    "divorced",
    "이혼",
    "WIDOWED",
    "widowed",
    "사별",
}


def run_node1(state: Mapping[str, Any]) -> dict[str, Any]:
    """Return Node 1's pipeline state patch.

    The current backend flow collects every required answer, so this node does
    not stop for "unknown" follow-up handling. Values are copied into tool input
    payloads as-is where possible.
    """
    profile = _extract_profile(state)
    available_supply_types = _available_supply_types(profile)

    tool_inputs: dict[str, dict[str, Any]] = {
        "special_supply": _build_special_supply_payload(profile),
    }
    warnings: list[str] = []

    general_payload = _build_housing_subscription_score_payload(profile)
    if general_payload is None:
        warnings.append(
            "general score input was skipped because birth_year or bankbook_join_date is missing"
        )
    else:
        tool_inputs["housing_subscription_score"] = general_payload

    result: dict[str, Any] = {
        "available_supply_types": available_supply_types,
        "tool_inputs": tool_inputs,
        "profile": profile,
    }
    if warnings:
        result["node1_warnings"] = warnings
    return result


def build_node1_state(state: Mapping[str, Any]) -> dict[str, Any]:
    """Backward-compatible alias for callers that prefer build_* naming."""
    return run_node1(state)


def _extract_profile(state: Mapping[str, Any]) -> dict[str, Any]:
    profile = state.get("profile", state)
    if isinstance(profile, Mapping):
        return dict(profile)
    raise TypeError("Node 1 state must contain a mapping profile")


def _available_supply_types(profile: Mapping[str, Any]) -> list[str]:
    if _bool_value(profile.get("is_homeless")) is False:
        return []

    available: list[str] = []
    if _is_newlywed_candidate(profile):
        available.append(NEWLYWED_SPECIAL)
    if _is_multi_child_candidate(profile):
        available.append(MULTI_CHILD_SPECIAL)
    if _is_first_home_candidate(profile):
        available.append(FIRST_HOME_SPECIAL)
    return available


def _is_newlywed_candidate(profile: Mapping[str, Any]) -> bool:
    # marital_status가 명확히 "미혼/이혼/사별"이면 다른 필드값과 상관없이 신혼부부
    # 특공 대상이 아님. 이 체크를 제일 먼저 해야 함 — 예전에는 marriage_period_years만
    # 보고 판단해서, 미혼인데 혼인 기간에 실수로(혹은 기본값으로) 0을 입력하면
    # "0 <= 7"이 True가 되어 신혼부부로 잘못 분류되는 문제가 있었음.
    marital_status = _text(profile.get("marital_status"))
    if marital_status in NOT_MARRIED_VALUES:
        return False

    marriage_period = _text(profile.get("marriage_period"))
    if marriage_period == "WITHIN_7_YEARS":
        return True
    if marriage_period == "OVER_7_YEARS":
        return False

    years = _int_value(profile.get("marriage_period_years"))
    if years is not None:
        return years <= 7

    return marital_status in MARRIED_VALUES


def _is_multi_child_candidate(profile: Mapping[str, Any]) -> bool:
    if _bool_value(profile.get("has_two_or_more_minor_children")) is True:
        return True

    minor_child_count = _int_value(profile.get("minor_child_count"))
    if minor_child_count is not None:
        return minor_child_count >= 2

    return (
        _text(profile.get("child_count_group")) in MULTI_CHILD_VALUES
        or _text(profile.get("minor_children_status")) in MULTI_CHILD_VALUES
    )


def _is_first_home_candidate(profile: Mapping[str, Any]) -> bool:
    return (
        _bool_value(profile.get("is_homeless")) is not False
        and _bool_value(profile.get("has_property_history")) is False
    )


def _build_special_supply_payload(profile: Mapping[str, Any]) -> dict[str, Any]:
    minor_child_count = _int_value(profile.get("minor_child_count"))
    has_two_or_more = _bool_value(profile.get("has_two_or_more_minor_children"))
    if has_two_or_more is None and minor_child_count is not None:
        has_two_or_more = minor_child_count >= 2

    return {
        "is_homeless": _bool_value(profile.get("is_homeless")),
        "is_household_head": _bool_value(profile.get("is_household_head")),
        "marital_status": _normalize_marital_status(profile.get("marital_status")),
        "marriage_period": _normalize_marriage_period(profile),
        "marriage_period_years": _int_value(profile.get("marriage_period_years")),
        "is_dual_income": _bool_value(profile.get("is_dual_income")),
        "has_two_or_more_minor_children": has_two_or_more,
        "child_count_group": _normalize_child_count_group(profile),
        "youngest_child_age_group": profile.get("youngest_child_age_group"),
        "has_property_history": _bool_value(profile.get("has_property_history")),
        "elderly_support": _normalize_elderly_support(profile),
        "bankbook_joined_months": _bankbook_joined_months(profile),
        "bankbook_payments": _int_value(profile.get("bankbook_payments")),
        "bankbook_balance": _int_value(profile.get("bankbook_balance")),
        "homeless_period_years": _int_value(profile.get("homeless_period_years")),
        "dependent_family_count": _dependent_family_count(profile),
        "num_household_members": _int_value(profile.get("num_household_members")),
        "average_monthly_income": _int_value(profile.get("average_monthly_income")),
        "total_assets": _int_value(profile.get("total_assets")),
        "minor_child_count": minor_child_count,
        "young_child_count": _int_value(profile.get("young_child_count")),
        "residence_period_years": _int_value(profile.get("residence_period_years")),
        "is_three_generation_household": _bool_value(
            profile.get("is_three_generation_household")
        ),
        "is_single_parent_family_5_years": _bool_value(
            profile.get("is_single_parent_family_5_years")
        ),
        "has_income_tax_payment_5_years": _bool_value(
            profile.get("has_income_tax_payment_5_years")
        ),
    }

def _is_married(profile: Mapping[str, Any]) -> bool:
    marital_status = _text(profile.get("marital_status"))
    return marital_status in MARRIED_VALUES


def _build_housing_subscription_score_payload(
    profile: Mapping[str, Any],
) -> dict[str, Any] | None:
    birth_date = profile.get("birth_date") or _birth_date_from_year(
        profile.get("birth_year")
    )
    subscription_join_date = profile.get("bankbook_join_date")
    if birth_date is None or subscription_join_date is None:
        return None

    payload: dict[str, Any] = {
        "birth_date": birth_date,
        "is_married": _is_married(profile),
        "dependent_family_count": _dependent_family_count(profile) or 0,
        "subscription_join_date": subscription_join_date,
    }

    optional_keys = {
        "marriage_date": "marriage_date",
        "homeless_start_date": "homeless_start_date",
        "announcement_date": "announcement_date",
        "spouse_subscription_join_date": "spouse_subscription_join_date",
        "include_spouse_subscription_score": "include_spouse_subscription_score",
    }
    for source_key, target_key in optional_keys.items():
        if source_key in profile:
            payload[target_key] = profile[source_key]
    return payload


def _normalize_marital_status(value: Any) -> str | None:
    text = _text(value)
    if text in MARRIED_VALUES:
        return "MARRIED"
    if text in {"SINGLE", "single", "미혼"}:
        return "SINGLE"
    return text or None


def _normalize_marriage_period(profile: Mapping[str, Any]) -> str | None:
    value = _text(profile.get("marriage_period"))
    if value:
        return value

    years = _int_value(profile.get("marriage_period_years"))
    if years is None:
        return None
    return "WITHIN_7_YEARS" if years <= 7 else "OVER_7_YEARS"


def _normalize_child_count_group(profile: Mapping[str, Any]) -> str | None:
    value = _text(profile.get("child_count_group"))
    if value:
        return value

    minor_child_count = _int_value(profile.get("minor_child_count"))
    if minor_child_count is not None:
        return "TWO_OR_MORE" if minor_child_count >= 2 else "ONE"

    if _text(profile.get("minor_children_status")) in MULTI_CHILD_VALUES:
        return "TWO_OR_MORE"
    if _text(profile.get("child_status")) in {"NO_CHILD", "no_child", "없음"}:
        return "NONE"
    return None


def _normalize_elderly_support(profile: Mapping[str, Any]) -> str | None:
    value = _text(profile.get("elderly_support"))
    if value:
        return value

    if _bool_value(profile.get("is_elderly_parent")) is not True:
        return None

    years = _int_value(profile.get("elderly_parent_years"))
    if years is not None and years >= 3:
        return "MEETS_65_AND_3Y"
    return "NEEDS_REVIEW"


def _bankbook_joined_months(profile: Mapping[str, Any]) -> int | None:
    explicit = _int_value(profile.get("bankbook_joined_months"))
    if explicit is not None:
        return explicit

    join_date = _parse_date(profile.get("bankbook_join_date"))
    if join_date is None:
        return None
    today = date.today()
    months = (today.year - join_date.year) * 12 + (today.month - join_date.month)
    if today.day < join_date.day:
        months -= 1
    return max(months, 0)


def _dependent_family_count(profile: Mapping[str, Any]) -> int | None:
    explicit = _int_value(profile.get("dependent_family_count"))
    if explicit is not None:
        return explicit

    members = _int_value(profile.get("num_household_members"))
    if members is None:
        return None
    return max(members - 1, 0)


def _birth_date_from_year(value: Any) -> str | None:
    year = _int_value(value)
    if year is None:
        return None
    return f"{year:04d}-01-01"


def _parse_date(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


def _text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _int_value(value: Any) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value
    try:
        return int(str(value).replace(",", "").strip())
    except ValueError:
        return None


def _bool_value(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if value is None:
        return None

    text = str(value).strip().lower()
    if text in {"true", "yes", "y", "1", "예", "네", "있음"}:
        return True
    if text in {"false", "no", "n", "0", "아니오", "아니요", "없음"}:
        return False
    return None


__all__ = ["build_node1_state", "run_node1"]

