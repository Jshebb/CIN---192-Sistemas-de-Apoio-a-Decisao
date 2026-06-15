"""Validation tests for the public API schemas."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas import CriterionInput, SolveRequest


def _valid_payload() -> dict:
    return {
        "alternatives": ["A", "B", "C"],
        "criteria": [
            {"name": "Cost", "weight": 0.6, "maximize": False, "preference": "usual"},
            {"name": "Quality", "weight": 0.4, "maximize": True, "preference": "v_shape", "p": 5.0},
        ],
        "matrix": [
            [250.0, 16.0],
            [200.0, 24.0],
            [300.0, 20.0],
        ],
    }


def test_solve_request_accepts_valid_payload() -> None:
    req = SolveRequest(**_valid_payload())

    assert req.alternatives == ["A", "B", "C"]
    assert len(req.criteria) == 2
    assert req.matrix[1] == [200.0, 24.0]


@pytest.mark.parametrize(
    ("criterion", "message"),
    [
        ({"name": "g", "weight": 1.0, "preference": "u_shape"}, "q"),
        ({"name": "g", "weight": 1.0, "preference": "v_shape"}, "p"),
        ({"name": "g", "weight": 1.0, "preference": "level", "q": 1.0}, "p"),
        ({"name": "g", "weight": 1.0, "preference": "linear", "p": 3.0}, "q"),
        ({"name": "g", "weight": 1.0, "preference": "gaussian"}, "s"),
    ],
)
def test_criterion_requires_parameters_for_preference_type(
    criterion: dict,
    message: str,
) -> None:
    with pytest.raises(ValidationError, match=message):
        CriterionInput(**criterion)


@pytest.mark.parametrize(
    ("criterion", "message"),
    [
        ({"name": "g", "weight": 1.0, "preference": "u_shape", "q": -0.1}, "q deve ser >= 0"),
        ({"name": "g", "weight": 1.0, "preference": "v_shape", "p": 0.0}, "p deve ser > 0"),
        (
            {"name": "g", "weight": 1.0, "preference": "level", "q": 2.0, "p": 1.0},
            "p deve ser >= q",
        ),
        (
            {"name": "g", "weight": 1.0, "preference": "linear", "q": 2.0, "p": 2.0},
            "p deve ser > q",
        ),
        ({"name": "g", "weight": 1.0, "preference": "gaussian", "s": 0.0}, "s deve ser > 0"),
    ],
)
def test_criterion_rejects_inconsistent_thresholds(
    criterion: dict,
    message: str,
) -> None:
    with pytest.raises(ValidationError, match=message):
        CriterionInput(**criterion)


def test_criterion_rejects_non_positive_weight() -> None:
    with pytest.raises(ValidationError, match="greater than 0"):
        CriterionInput(name="g", weight=0.0, preference="usual")


def test_solve_request_rejects_duplicate_alternatives() -> None:
    payload = _valid_payload()
    payload["alternatives"] = ["A", "A", "C"]

    with pytest.raises(ValidationError, match="únicos"):
        SolveRequest(**payload)


def test_solve_request_rejects_wrong_number_of_rows() -> None:
    payload = _valid_payload()
    payload["matrix"] = [[1.0, 2.0]]

    with pytest.raises(ValidationError, match="linhas"):
        SolveRequest(**payload)


def test_solve_request_rejects_wrong_number_of_columns() -> None:
    payload = _valid_payload()
    payload["matrix"][1] = [200.0]

    with pytest.raises(ValidationError, match="critérios"):
        SolveRequest(**payload)
