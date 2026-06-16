"""Service-layer tests between schemas and the PROMETHEE core."""

from __future__ import annotations

import numpy as np

from app.api import service
from app.schemas import SolveRequest


def _payload() -> dict:
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


def test_service_returns_exact_scores_and_preference_index() -> None:
    result = service.solve(SolveRequest(**_payload()))

    assert [score.name for score in result.scores] == ["B", "A", "C"]
    assert [score.rank for score in result.scores] == [1, 2, 3]
    np.testing.assert_allclose(
        [score.phi_net for score in result.scores],
        [0.96, -0.36, -0.60],
    )
    np.testing.assert_allclose(
        result.preference_index,
        [
            [0.0, 0.0, 0.6],
            [1.0, 0.0, 0.92],
            [0.32, 0.0, 0.0],
        ],
    )
    assert result.gaia is not None
    assert len(result.gaia.alternatives) == 3
    assert len(result.gaia.criteria) == 2
    assert 0.0 <= result.gaia.quality <= 1.0


def test_service_omits_gaia_for_single_criterion_problem() -> None:
    payload = {
        "alternatives": ["A", "B"],
        "criteria": [{"name": "Benefit", "weight": 1.0, "preference": "usual"}],
        "matrix": [[1.0], [2.0]],
    }

    result = service.solve(SolveRequest(**payload))

    assert result.gaia is None
    assert [score.name for score in result.scores] == ["B", "A"]
    assert result.preference_index == [[0.0, 0.0], [1.0, 0.0]]
