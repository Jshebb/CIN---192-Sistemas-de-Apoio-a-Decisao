"""Testes do PROMETHEE II com exemplo verificável analiticamente.

Caso de 1 critério (maximizar, função usual), valores A=10, B=20, C=30:

* φ⁺ = (0, 0.5, 1.0)   φ⁻ = (1.0, 0.5, 0)   φ = (-1, 0, +1)
* ranking: C (1º), B (2º), A (3º)
"""

import numpy as np
import pytest

from app.core.flows import CriterionSpec, compute_flows
from app.core.preference_functions import PreferenceType
from app.core.promethee_ii import rank


def _single_criterion():
    matrix = np.array([[10.0], [20.0], [30.0]])
    criteria = [CriterionSpec(name="g1", weight=1.0, maximize=True, preference=PreferenceType.USUAL)]
    names = ["A", "B", "C"]
    return matrix, criteria, names


def test_flows_single_criterion():
    matrix, criteria, _ = _single_criterion()
    flows = compute_flows(matrix, criteria)
    np.testing.assert_allclose(flows.phi_plus, [0.0, 0.5, 1.0])
    np.testing.assert_allclose(flows.phi_minus, [1.0, 0.5, 0.0])
    np.testing.assert_allclose(flows.phi_net, [-1.0, 0.0, 1.0])


def test_net_flow_sums_to_zero():
    matrix, criteria, _ = _single_criterion()
    flows = compute_flows(matrix, criteria)
    assert flows.phi_net.sum() == pytest.approx(0.0)


def test_ranking_order():
    matrix, criteria, names = _single_criterion()
    result = rank(matrix, criteria, names)
    by_rank = {s.rank: s.name for s in result.scores}
    assert by_rank == {1: "C", 2: "B", 3: "A"}


def test_minimize_inverts_preference():
    # Mesmos valores, mas agora menor é melhor → A vira o melhor.
    matrix = np.array([[10.0], [20.0], [30.0]])
    criteria = [CriterionSpec(name="g1", weight=1.0, maximize=False, preference=PreferenceType.USUAL)]
    result = rank(matrix, criteria, ["A", "B", "C"])
    by_rank = {s.rank: s.name for s in result.scores}
    assert by_rank == {1: "A", 2: "B", 3: "C"}


def test_weights_are_normalized():
    matrix = np.array([[10.0, 1.0], [20.0, 2.0]])
    criteria = [
        CriterionSpec(name="g1", weight=3.0, preference=PreferenceType.USUAL),
        CriterionSpec(name="g2", weight=1.0, preference=PreferenceType.USUAL),
    ]
    flows = compute_flows(matrix, criteria)
    np.testing.assert_allclose(flows.weights, [0.75, 0.25])


def test_dimension_mismatch_raises():
    with pytest.raises(ValueError):
        compute_flows(
            np.array([[1.0, 2.0]]),
            [CriterionSpec(name="only_one", weight=1.0)],
        )


# ---------------------------------------------------------------------------
# Caso canônico: Brans, Vincke & Mareschal (1986) — seleção de projetos
# hidrelétricos. Todos os 6 tipos de função de preferência são exercitados.
# Ranking esperado: x5 > x2 > x4 > x6 > x3 > x1
# ---------------------------------------------------------------------------

_HYDRO_MATRIX = np.array([
    [80, 90,  6,  5.4, 8,  5],   # x1
    [65, 58,  2,  9.7, 1,  1],   # x2
    [83, 60,  4,  7.2, 4,  7],   # x3
    [40, 80, 10,  7.5, 7, 10],   # x4
    [52, 72,  6,  2.0, 3,  8],   # x5
    [94, 96,  7,  3.6, 5,  6],   # x6
], dtype=float)

_HYDRO_CRITERIA = [
    # f1 — Mão-de-obra:              Min, Tipo II  (U-shape),      q=10
    CriterionSpec("f1", weight=1/6, maximize=False, preference=PreferenceType.U_SHAPE,  q=10),
    # f2 — Potência (MW):            Max, Tipo III (V-shape),      p=30
    CriterionSpec("f2", weight=1/6, maximize=True,  preference=PreferenceType.V_SHAPE,  p=30),
    # f3 — Custo construção (10⁹$): Min, Tipo V   (Linear+indif.), q=0.5, p=5
    CriterionSpec("f3", weight=1/6, maximize=False, preference=PreferenceType.LINEAR,   q=0.5, p=5),
    # f4 — Custo manutenção (10⁶$): Min, Tipo IV  (Nível),        q=1, p=6
    CriterionSpec("f4", weight=1/6, maximize=False, preference=PreferenceType.LEVEL,    q=1,   p=6),
    # f5 — Vilarejos a evacuar:      Min, Tipo I   (Usual)
    CriterionSpec("f5", weight=1/6, maximize=False, preference=PreferenceType.USUAL),
    # f6 — Nível de segurança:       Max, Tipo VI  (Gaussiana),    s=5
    CriterionSpec("f6", weight=1/6, maximize=True,  preference=PreferenceType.GAUSSIAN, s=5),
]

_HYDRO_NAMES = ["x1", "x2", "x3", "x4", "x5", "x6"]


def test_hydroelectric_ranking():
    """Ranking canônico deve ser x5 > x2 > x4 > x6 > x3 > x1."""
    result = rank(_HYDRO_MATRIX, _HYDRO_CRITERIA, _HYDRO_NAMES)
    by_rank = {s.rank: s.name for s in result.scores}
    assert by_rank == {1: "x5", 2: "x2", 3: "x4", 4: "x6", 5: "x3", 6: "x1"}


def test_hydroelectric_phi_net():
    """Fluxos líquidos devem corresponder aos valores do artigo original (Brans 1986)."""
    result = rank(_HYDRO_MATRIX, _HYDRO_CRITERIA, _HYDRO_NAMES)
    phi = {s.name: s.phi_net for s in result.scores}
    assert phi["x5"] == pytest.approx(+0.2929, abs=1e-3)
    assert phi["x2"] == pytest.approx(+0.0172, abs=1e-3)
    assert phi["x4"] == pytest.approx(-0.0200, abs=1e-3)
    assert phi["x6"] == pytest.approx(-0.0549, abs=1e-3)
    assert phi["x3"] == pytest.approx(-0.0895, abs=1e-3)
    assert phi["x1"] == pytest.approx(-0.1457, abs=1e-3)


def test_hydroelectric_u_shape_vs_usual():
    """Usar Tipo I em vez de Tipo II para f1 inverte x1 e x3 nas posições 5-6."""
    criteria_wrong = list(_HYDRO_CRITERIA)
    criteria_wrong[0] = CriterionSpec(
        "f1", weight=1/6, maximize=False, preference=PreferenceType.USUAL
    )
    result = rank(_HYDRO_MATRIX, criteria_wrong, _HYDRO_NAMES)
    by_rank = {s.rank: s.name for s in result.scores}
    # Com Tipo I, x1 sobe para 5º e x3 cai para 6º
    assert by_rank[5] == "x1"
    assert by_rank[6] == "x3"


def test_ranking_keeps_ties_with_shared_rank_and_stable_order():
    matrix = np.array([[10.0], [10.0], [5.0]])
    criteria = [CriterionSpec(name="g1", weight=1.0, preference=PreferenceType.USUAL)]

    result = rank(matrix, criteria, ["A", "B", "C"])

    assert [(score.name, score.rank) for score in result.scores] == [
        ("A", 1),
        ("B", 1),
        ("C", 3),
    ]
    np.testing.assert_allclose([score.phi_net for score in result.scores], [0.5, 0.5, -1.0])


def test_ranking_matches_mixed_cost_quality_problem():
    matrix = np.array(
        [
            [100.0, 70.0],
            [80.0, 60.0],
            [120.0, 90.0],
        ]
    )
    criteria = [
        CriterionSpec("Cost", 2.0, maximize=False, preference=PreferenceType.USUAL),
        CriterionSpec("Quality", 1.0, maximize=True, preference=PreferenceType.V_SHAPE, p=40.0),
    ]

    result = rank(matrix, criteria, ["A", "B", "C"])

    assert [(score.name, score.rank) for score in result.scores] == [
        ("B", 1),
        ("A", 2),
        ("C", 3),
    ]
    np.testing.assert_allclose([score.phi_net for score in result.scores], [1.0 / 2.0, -1.0 / 24.0, -11.0 / 24.0])


def test_ranking_rejects_alternative_name_mismatch():
    matrix = np.array([[1.0], [2.0]])
    criteria = [CriterionSpec(name="g1", weight=1.0, preference=PreferenceType.USUAL)]

    with pytest.raises(ValueError, match="nomes difere"):
        rank(matrix, criteria, ["A"])
