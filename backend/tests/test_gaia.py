"""Tests for GAIA plane projection."""

from __future__ import annotations

import numpy as np
import pytest

from app.core.gaia import compute_gaia


def test_gaia_shapes_quality_and_centering_for_two_criteria() -> None:
    unicriterion_flows = np.array(
        [
            [0.0, -1.0 / 8.0],
            [1.0, -1.0 / 2.0],
            [-1.0, 5.0 / 8.0],
        ]
    )
    weights = np.array([2.0 / 3.0, 1.0 / 3.0])

    gaia = compute_gaia(unicriterion_flows, weights)

    assert gaia.alternatives.shape == (3, 2)
    assert gaia.criteria.shape == (2, 2)
    assert gaia.decision_axis.shape == (2,)
    assert gaia.quality == pytest.approx(1.0)
    np.testing.assert_allclose(gaia.alternatives.mean(axis=0), [0.0, 0.0], atol=1e-12)
    np.testing.assert_allclose(gaia.criteria.T @ gaia.criteria, np.eye(2), atol=1e-12)
    assert np.linalg.norm(gaia.decision_axis) == pytest.approx(np.linalg.norm(weights))


def test_gaia_degenerate_zero_variance_has_zero_quality() -> None:
    gaia = compute_gaia(
        unicriterion_flows=np.array([[1.0, 1.0], [1.0, 1.0], [1.0, 1.0]]),
        weights=np.array([0.5, 0.5]),
    )

    assert gaia.quality == 0.0
    np.testing.assert_allclose(gaia.alternatives, np.zeros((3, 2)))


def test_gaia_requires_at_least_two_criteria() -> None:
    with pytest.raises(ValueError, match="ao menos 2"):
        compute_gaia(
            unicriterion_flows=np.array([[0.0], [1.0], [-1.0]]),
            weights=np.array([1.0]),
        )
