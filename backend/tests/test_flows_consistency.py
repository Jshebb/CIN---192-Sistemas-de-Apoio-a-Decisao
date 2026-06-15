"""Consistency tests for PROMETHEE outranking flows."""

from __future__ import annotations

import numpy as np
import pytest

from app.core.flows import CriterionSpec, compute_flows
from app.core.preference_functions import PreferenceType


def _mixed_problem() -> tuple[np.ndarray, list[CriterionSpec]]:
    matrix = np.array(
        [
            [100.0, 70.0],
            [80.0, 60.0],
            [120.0, 90.0],
        ]
    )
    criteria = [
        CriterionSpec(
            name="Cost",
            weight=2.0,
            maximize=False,
            preference=PreferenceType.USUAL,
        ),
        CriterionSpec(
            name="Quality",
            weight=1.0,
            maximize=True,
            preference=PreferenceType.V_SHAPE,
            p=40.0,
        ),
    ]
    return matrix, criteria


def test_mixed_problem_matches_hand_calculated_values() -> None:
    matrix, criteria = _mixed_problem()

    flows = compute_flows(matrix, criteria)

    expected_preference_index = np.array(
        [
            [0.0, 1.0 / 12.0, 2.0 / 3.0],
            [2.0 / 3.0, 0.0, 2.0 / 3.0],
            [1.0 / 6.0, 1.0 / 4.0, 0.0],
        ]
    )
    expected_unicriterion_flows = np.array(
        [
            [0.0, -1.0 / 8.0],
            [1.0, -1.0 / 2.0],
            [-1.0, 5.0 / 8.0],
        ]
    )

    np.testing.assert_allclose(flows.weights, [2.0 / 3.0, 1.0 / 3.0])
    np.testing.assert_allclose(flows.preference_index, expected_preference_index)
    np.testing.assert_allclose(flows.phi_plus, [3.0 / 8.0, 2.0 / 3.0, 5.0 / 24.0])
    np.testing.assert_allclose(flows.phi_minus, [5.0 / 12.0, 1.0 / 6.0, 2.0 / 3.0])
    np.testing.assert_allclose(flows.phi_net, [-1.0 / 24.0, 1.0 / 2.0, -11.0 / 24.0])
    np.testing.assert_allclose(flows.unicriterion_flows, expected_unicriterion_flows)


def test_flow_identities_hold_for_mixed_problem() -> None:
    matrix, criteria = _mixed_problem()

    flows = compute_flows(matrix, criteria)
    n = matrix.shape[0]

    np.testing.assert_allclose(np.diag(flows.preference_index), np.zeros(n))
    assert np.all(flows.preference_index >= 0.0)
    assert np.all(flows.preference_index <= 1.0)
    np.testing.assert_allclose(
        flows.phi_plus,
        flows.preference_index.sum(axis=1) / (n - 1),
    )
    np.testing.assert_allclose(
        flows.phi_minus,
        flows.preference_index.sum(axis=0) / (n - 1),
    )
    np.testing.assert_allclose(flows.phi_net, flows.phi_plus - flows.phi_minus)
    assert flows.phi_net.sum() == pytest.approx(0.0, abs=1e-12)
    np.testing.assert_allclose(flows.unicriterion_flows @ flows.weights, flows.phi_net)


def test_weight_scaling_does_not_change_normalized_result() -> None:
    matrix, criteria = _mixed_problem()
    scaled_criteria = [
        CriterionSpec(
            name="Cost",
            weight=20.0,
            maximize=False,
            preference=PreferenceType.USUAL,
        ),
        CriterionSpec(
            name="Quality",
            weight=10.0,
            maximize=True,
            preference=PreferenceType.V_SHAPE,
            p=40.0,
        ),
    ]

    flows = compute_flows(matrix, criteria)
    scaled_flows = compute_flows(matrix, scaled_criteria)

    np.testing.assert_allclose(scaled_flows.weights, flows.weights)
    np.testing.assert_allclose(scaled_flows.preference_index, flows.preference_index)
    np.testing.assert_allclose(scaled_flows.phi_net, flows.phi_net)


def test_identical_alternatives_generate_zero_flows() -> None:
    matrix = np.array([[10.0, 5.0], [10.0, 5.0], [10.0, 5.0]])
    criteria = [
        CriterionSpec(name="g1", weight=1.0, preference=PreferenceType.USUAL),
        CriterionSpec(name="g2", weight=1.0, preference=PreferenceType.LINEAR, q=1.0, p=3.0),
    ]

    flows = compute_flows(matrix, criteria)

    np.testing.assert_allclose(flows.preference_index, np.zeros((3, 3)))
    np.testing.assert_allclose(flows.phi_plus, np.zeros(3))
    np.testing.assert_allclose(flows.phi_minus, np.zeros(3))
    np.testing.assert_allclose(flows.phi_net, np.zeros(3))
    np.testing.assert_allclose(flows.unicriterion_flows, np.zeros((3, 2)))


@pytest.mark.parametrize(
    ("matrix", "criteria", "message"),
    [
        (
            np.array([[1.0]]),
            [CriterionSpec(name="g1", weight=1.0)],
            "ao menos 2 alternativas",
        ),
        (
            np.array([[1.0, 2.0], [3.0, 4.0]]),
            [CriterionSpec(name="g1", weight=1.0)],
            "difere das colunas",
        ),
        (
            np.array([[1.0], [2.0]]),
            [CriterionSpec(name="g1", weight=-1.0)],
            "negativos",
        ),
        (
            np.array([[1.0], [2.0]]),
            [CriterionSpec(name="g1", weight=0.0)],
            "positiva",
        ),
    ],
)
def test_invalid_flow_inputs_raise(
    matrix: np.ndarray,
    criteria: list[CriterionSpec],
    message: str,
) -> None:
    with pytest.raises(ValueError, match=message):
        compute_flows(matrix, criteria)
