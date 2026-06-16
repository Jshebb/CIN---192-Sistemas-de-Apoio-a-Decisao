"""Análise de sensibilidade dos pesos no PROMETHEE II.

Pergunta central: *quão estável é o ranking diante de variações nos
pesos?* Para cada critério ``k`` varia-se o seu peso normalizado de 0 a 1
e, a cada passo, os demais pesos são reescalados proporcionalmente (para
que a soma continue 1). Registra-se o intervalo contínuo de peso, em
torno do valor atual, no qual:

* o **ranking completo** permanece idêntico; e
* o **1º colocado** (melhor compromisso) não muda.

Esses intervalos de estabilidade são o equivalente prático da clássica
"weight stability interval" do PROMETHEE — mostram de quanto o decisor
pode mudar cada peso sem alterar a conclusão.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .flows import (
    CriterionSpec,
    criterion_preference_matrices,
    flows_from_preference_matrices,
    normalize_weights,
)


@dataclass(frozen=True)
class CriterionStability:
    """Intervalos de estabilidade do peso de um critério (espaço normalizado)."""

    name: str
    weight: float          # peso normalizado atual
    rank_lower: float      # ranking completo estável em [rank_lower, rank_upper]
    rank_upper: float
    winner_lower: float    # 1º colocado estável em [winner_lower, winner_upper]
    winner_upper: float


@dataclass(frozen=True)
class SensitivityResult:
    base_order: list[int]          # índices das alternativas, do 1º ao último
    criteria: list[CriterionStability]


def _order(phi_net: np.ndarray) -> tuple[int, ...]:
    """Ordem das alternativas por φ líquido decrescente (empate estável)."""
    return tuple(int(i) for i in np.argsort(-phi_net, kind="stable"))


def _reweighted(weights: np.ndarray, k: int, value: float) -> np.ndarray:
    """Vetor de pesos com ``w_k = value`` e o resto reescalado p/ somar 1."""
    rest = 1.0 - weights[k]
    new = weights.copy()
    if rest <= 1e-12:  # critério domina tudo; mantém os demais em zero
        new[k] = value
        return new
    scale = (1.0 - value) / rest
    new *= scale
    new[k] = value
    return new


def weight_stability(
    matrix: np.ndarray,
    criteria: list[CriterionSpec],
    steps: int = 201,
) -> SensitivityResult:
    """Calcula os intervalos de estabilidade de peso de cada critério."""
    matrix = np.asarray(matrix, dtype=float)
    pref_matrices = criterion_preference_matrices(matrix, criteria)
    w0 = normalize_weights(criteria)
    m = len(criteria)

    _, _, _, base_phi = flows_from_preference_matrices(pref_matrices, w0)
    base_order = _order(base_phi)
    base_winner = base_order[0]

    grid = np.linspace(0.0, 1.0, steps)
    out: list[CriterionStability] = []

    for k, spec in enumerate(criteria):
        wk = float(w0[k])
        # Grade ordenada incluindo o peso atual, para ancorar a expansão.
        ts = sorted(set(grid.tolist()) | {wk})
        anchor = ts.index(wk)

        orders: list[tuple[int, ...]] = []
        for t in ts:
            _, _, _, phi = flows_from_preference_matrices(
                pref_matrices, _reweighted(w0, k, t)
            )
            orders.append(_order(phi))

        rank_lo, rank_hi = _expand(ts, orders, anchor, lambda o: o == base_order)
        win_lo, win_hi = _expand(ts, orders, anchor, lambda o: o[0] == base_winner)

        out.append(
            CriterionStability(
                name=spec.name,
                weight=wk,
                rank_lower=rank_lo,
                rank_upper=rank_hi,
                winner_lower=win_lo,
                winner_upper=win_hi,
            )
        )

    return SensitivityResult(base_order=list(base_order), criteria=out)


def _expand(ts, orders, anchor, keep) -> tuple[float, float]:
    """Maior intervalo contínuo em torno de ``anchor`` que satisfaz ``keep``."""
    lo = anchor
    while lo - 1 >= 0 and keep(orders[lo - 1]):
        lo -= 1
    hi = anchor
    while hi + 1 < len(ts) and keep(orders[hi + 1]):
        hi += 1
    return float(ts[lo]), float(ts[hi])
