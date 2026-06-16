"""Testes do núcleo de análise de sensibilidade (weight stability)."""

import numpy as np

from app.core.flows import CriterionSpec
from app.core.preference_functions import PreferenceType
from app.core.sensitivity import weight_stability


def _specs(w1: float, w2: float) -> list[CriterionSpec]:
    return [
        CriterionSpec(name="Custo", weight=w1, maximize=False, preference=PreferenceType.USUAL),
        CriterionSpec(
            name="Qualidade", weight=w2, maximize=True, preference=PreferenceType.V_SHAPE, p=5.0
        ),
    ]


MATRIX = np.array([[250.0, 16.0], [200.0, 24.0], [300.0, 20.0]])


def test_intervals_contain_current_weight_and_are_ordered():
    result = weight_stability(MATRIX, _specs(0.6, 0.4))
    assert [c.name for c in result.criteria] == ["Custo", "Qualidade"]
    for c in result.criteria:
        assert c.rank_lower <= c.weight <= c.rank_upper
        assert c.winner_lower <= c.rank_lower
        assert c.winner_upper >= c.rank_upper


def test_single_criterion_is_fully_stable():
    specs = [CriterionSpec(name="Único", weight=1.0, preference=PreferenceType.USUAL)]
    result = weight_stability(MATRIX[:, :1], specs)
    (c,) = result.criteria
    # com um só critério o ranking só muda no extremo degenerado (peso 0, em que
    # tudo empata); para qualquer peso positivo a ordem é a mesma.
    assert c.rank_lower <= 0.01
    assert c.rank_upper == 1.0


def test_base_order_matches_promethee_ranking():
    result = weight_stability(MATRIX, _specs(0.6, 0.4))
    # B (idx 1) é o melhor compromisso nos números de referência
    assert result.base_order[0] == 1


def test_reweighting_preserves_unit_sum():
    # varrer o peso de um critério não deve quebrar a normalização: o intervalo
    # devolvido vive em [0, 1] no espaço de pesos normalizados.
    result = weight_stability(MATRIX, _specs(0.3, 0.7))
    for c in result.criteria:
        assert 0.0 <= c.rank_lower <= c.rank_upper <= 1.0
        assert 0.0 <= c.winner_lower <= c.winner_upper <= 1.0
