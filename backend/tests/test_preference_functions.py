"""Testes das 6 funções de preferência (Brans & Vincke, 1986)."""

import numpy as np
import pytest

from app.core.preference_functions import (
    PreferenceType,
    apply_preference,
    gaussian,
    level,
    linear,
    u_shape,
    usual,
    v_shape,
)


def test_usual():
    assert usual(np.array(-1.0)) == 0.0
    assert usual(np.array(0.0)) == 0.0
    assert usual(np.array(0.5)) == 1.0


def test_u_shape():
    assert u_shape(np.array(0.5), q=1.0) == 0.0
    assert u_shape(np.array(1.0), q=1.0) == 0.0  # estritamente maior que q
    assert u_shape(np.array(2.0), q=1.0) == 1.0


def test_v_shape():
    assert v_shape(np.array(1.0), p=2.0) == pytest.approx(0.5)
    assert v_shape(np.array(3.0), p=2.0) == 1.0
    assert v_shape(np.array(-1.0), p=2.0) == 0.0


def test_level():
    assert level(np.array(0.0), q=1.0, p=3.0) == 0.0
    assert level(np.array(2.0), q=1.0, p=3.0) == 0.5
    assert level(np.array(4.0), q=1.0, p=3.0) == 1.0


def test_linear():
    assert linear(np.array(0.5), q=1.0, p=3.0) == 0.0
    assert linear(np.array(2.0), q=1.0, p=3.0) == pytest.approx(0.5)
    assert linear(np.array(4.0), q=1.0, p=3.0) == 1.0


def test_gaussian():
    assert gaussian(np.array(1.0), s=1.0) == pytest.approx(1 - np.exp(-0.5))
    assert gaussian(np.array(-1.0), s=1.0) == 0.0


def test_apply_dispatch_and_validation():
    assert apply_preference(np.array(2.0), PreferenceType.USUAL) == 1.0
    with pytest.raises(ValueError):
        apply_preference(np.array(2.0), PreferenceType.LINEAR)  # faltam q, p


def test_vectorized():
    d = np.array([-1.0, 0.0, 1.0, 5.0])
    out = apply_preference(d, PreferenceType.V_SHAPE, p=2.0)
    np.testing.assert_allclose(out, [0.0, 0.0, 0.5, 1.0])


@pytest.mark.parametrize(
    ("ptype", "params"),
    [
        (PreferenceType.USUAL, {}),
        (PreferenceType.U_SHAPE, {"q": 1.0}),
        (PreferenceType.V_SHAPE, {"p": 3.0}),
        (PreferenceType.LEVEL, {"q": 1.0, "p": 3.0}),
        (PreferenceType.LINEAR, {"q": 1.0, "p": 3.0}),
        (PreferenceType.GAUSSIAN, {"s": 2.0}),
    ],
)
def test_preference_outputs_are_bounded_zero_for_nonpositive_and_monotone(ptype, params):
    d = np.linspace(-2.0, 6.0, 80)

    out = apply_preference(d, ptype, **params)

    assert out.shape == d.shape
    assert np.all(out >= 0.0)
    assert np.all(out <= 1.0)
    np.testing.assert_allclose(out[d <= 0.0], 0.0)
    assert np.all(np.diff(out) >= -1e-12)


@pytest.mark.parametrize(
    ("fn", "kwargs"),
    [
        (v_shape, {"p": 0.0}),
        (v_shape, {"p": -1.0}),
        (level, {"q": 2.0, "p": 1.0}),
        (linear, {"q": 1.0, "p": 1.0}),
        (linear, {"q": 2.0, "p": 1.0}),
        (gaussian, {"s": 0.0}),
        (gaussian, {"s": -1.0}),
    ],
)
def test_invalid_preference_thresholds_raise(fn, kwargs):
    with pytest.raises(ValueError):
        fn(np.array(1.0), **kwargs)


@pytest.mark.parametrize(
    ("ptype", "params"),
    [
        (PreferenceType.U_SHAPE, {}),
        (PreferenceType.V_SHAPE, {}),
        (PreferenceType.LEVEL, {"q": 1.0}),
        (PreferenceType.LINEAR, {"p": 3.0}),
        (PreferenceType.GAUSSIAN, {}),
    ],
)
def test_apply_preference_requires_all_parameters(ptype, params):
    with pytest.raises(ValueError, match="Parâmetros obrigatórios ausentes"):
        apply_preference(np.array(1.0), ptype, **params)


def test_apply_preference_rejects_unknown_type():
    with pytest.raises(ValueError, match="Tipo de preferência desconhecido"):
        apply_preference(np.array(1.0), "unknown")  # type: ignore[arg-type]
