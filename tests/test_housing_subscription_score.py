from datetime import date
from pathlib import Path
import sys
import types

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1] / "Backend"
BACKEND_SRC = BACKEND_ROOT / "src"
sys.path.insert(0, str(BACKEND_ROOT))

src_package = types.ModuleType("src")
src_package.__path__ = [str(BACKEND_SRC)]
sys.modules["src"] = src_package

from src.engine.tools.calculator.housing_subscription_score import (
    HousingSubscriptionScoreInput,
    calculate_housing_subscription_score,
)


def score_case(**overrides):
    data = {
        "birth_date": date(1980, 1, 1),
        "is_married": False,
        "homeless_start_date": None,
        "dependent_family_count": 0,
        "subscription_join_date": date(2026, 1, 1),
        "announcement_date": date(2026, 1, 1),
    }
    data.update(overrides)
    return calculate_housing_subscription_score(data)


def test_unmarried_under_30_has_zero_homeless_period_score():
    result = score_case(
        birth_date=date(2000, 1, 1),
        announcement_date=date(2026, 1, 1),
        subscription_join_date=date(2026, 1, 1),
    )

    assert result.homeless_period_years == 0
    assert result.homeless_score == 0
    assert result.dependent_family_score == 5
    assert result.subscription_score == 1
    assert result.total_score == 6


@pytest.mark.parametrize(
    ("homeless_start_date", "expected_years", "expected_score"),
    [
        (date(2025, 1, 1), 1, 4),
        (date(2024, 1, 1), 2, 6),
        (date(2011, 1, 1), 15, 32),
    ],
)
def test_homeless_period_boundary_scores(homeless_start_date, expected_years, expected_score):
    result = score_case(homeless_start_date=homeless_start_date)

    assert result.homeless_period_years == expected_years
    assert result.homeless_score == expected_score


@pytest.mark.parametrize(
    ("dependent_family_count", "expected_score"),
    [
        (0, 5),
        (1, 10),
        (6, 35),
        (7, 35),
    ],
)
def test_dependent_family_boundary_scores(dependent_family_count, expected_score):
    result = score_case(dependent_family_count=dependent_family_count)

    assert result.dependent_family_score == expected_score


@pytest.mark.parametrize(
    ("subscription_join_date", "expected_years", "expected_score"),
    [
        (date(2026, 1, 1), 0, 1),
        (date(2025, 7, 1), 0, 2),
        (date(2025, 1, 1), 1, 3),
        (date(2011, 1, 1), 15, 17),
    ],
)
def test_subscription_period_boundary_scores(
    subscription_join_date,
    expected_years,
    expected_score,
):
    result = score_case(subscription_join_date=subscription_join_date)

    assert result.subscription_period_years == expected_years
    assert result.subscription_score == expected_score


def test_maximum_general_supply_score_is_capped_at_84():
    result = score_case(
        homeless_start_date=date(2000, 1, 1),
        dependent_family_count=6,
        subscription_join_date=date(2000, 1, 1),
    )

    assert result.homeless_score == 32
    assert result.dependent_family_score == 35
    assert result.subscription_score == 17
    assert result.total_score == 84


def test_marriage_before_age_30_uses_marriage_date_and_caps_spouse_bonus():
    result = score_case(
        birth_date=date(2000, 1, 1),
        is_married=True,
        marriage_date=date(2022, 1, 1),
        dependent_family_count=2,
        subscription_join_date=date(2020, 1, 1),
        spouse_subscription_join_date=date(2000, 1, 1),
        include_spouse_subscription_score=True,
    )

    assert result.homeless_period_years == 4
    assert result.homeless_score == 10
    assert result.dependent_family_score == 15
    assert result.spouse_subscription_score == 3
    assert result.subscription_score == 11
    assert result.total_score == 36


def test_future_subscription_join_date_is_rejected():
    with pytest.raises(ValueError):
        HousingSubscriptionScoreInput(
            birth_date=date(1990, 1, 1),
            subscription_join_date=date(2026, 1, 2),
            announcement_date=date(2026, 1, 1),
            dependent_family_count=0,
        )
