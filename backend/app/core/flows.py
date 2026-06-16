"""Cálculo dos fluxos de superação (outranking flows) do PROMETHEE.

Etapas (Brans & Vincke, 1986):

1. Para cada par de alternativas (a, b) e cada critério k, calcula-se o
   grau de preferência ``P_k(a, b)`` via função de preferência.
2. Índice de preferência agregado ``π(a, b) = Σ_k w_k · P_k(a, b)``
   (pesos normalizados para somar 1).
3. Fluxo de saída  ``φ⁺(a) = 1/(n-1) · Σ_b π(a, b)``.
4. Fluxo de entrada ``φ⁻(a) = 1/(n-1) · Σ_b π(b, a)``.
5. Fluxo líquido   ``φ(a)  = φ⁺(a) − φ⁻(a)``  (base do PROMETHEE II).

Também expõe os fluxos líquidos *unicritério* usados pelo plano GAIA.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .preference_functions import PreferenceType, apply_preference


@dataclass(frozen=True)
class CriterionSpec:
    """Configuração de um critério."""

    name: str
    weight: float
    maximize: bool = True
    preference: PreferenceType = PreferenceType.USUAL
    q: float | None = None
    p: float | None = None
    s: float | None = None


@dataclass(frozen=True)
class FlowResult:
    """Resultado completo do cálculo de fluxos."""

    phi_plus: np.ndarray          # (n,)  fluxo positivo
    phi_minus: np.ndarray         # (n,)  fluxo negativo
    phi_net: np.ndarray           # (n,)  fluxo líquido
    preference_index: np.ndarray  # (n, n) índice agregado π
    unicriterion_flows: np.ndarray  # (n, m) φ líquido por critério (GAIA)
    weights: np.ndarray           # (m,)  pesos normalizados


def _pairwise_diff(column: np.ndarray) -> np.ndarray:
    """Matriz (n, n) de diferenças d[i, j] = column[i] - column[j]."""
    return column[:, None] - column[None, :]


def criterion_preference_matrices(
    matrix: np.ndarray,
    criteria: list[CriterionSpec],
) -> np.ndarray:
    """Grau de preferência ``P_k(a, b)`` por critério, sem pesos.

    Devolve um array ``(m, n, n)`` onde a fatia ``k`` é a matriz de
    preferência do critério ``k`` (já orientada para maximização e com a
    diagonal zerada). Como não depende dos pesos, pode ser calculada uma
    única vez e reaproveitada para varrer diferentes vetores de peso —
    base da análise de sensibilidade.
    """
    matrix = np.asarray(matrix, dtype=float)
    n, m = matrix.shape
    if m != len(criteria):
        raise ValueError(
            f"Nº de critérios ({len(criteria)}) difere das colunas da matriz ({m})."
        )

    mats = np.zeros((m, n, n), dtype=float)
    for k, spec in enumerate(criteria):
        diff = _pairwise_diff(matrix[:, k])
        if not spec.maximize:
            diff = -diff  # critério de minimização → inverte a orientação
        p_k = apply_preference(diff, spec.preference, q=spec.q, p=spec.p, s=spec.s)
        np.fill_diagonal(p_k, 0.0)
        mats[k] = p_k
    return mats


def normalize_weights(criteria: list[CriterionSpec]) -> np.ndarray:
    """Pesos dos critérios normalizados para somar 1 (com validação)."""
    weights = np.array([c.weight for c in criteria], dtype=float)
    if np.any(weights < 0):
        raise ValueError("Pesos não podem ser negativos.")
    total = weights.sum()
    if total <= 0:
        raise ValueError("A soma dos pesos deve ser positiva.")
    return weights / total


def flows_from_preference_matrices(
    pref_matrices: np.ndarray,
    weights: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Agrega ``P_k`` ponderado e devolve ``(π, φ⁺, φ⁻, φ)``.

    ``weights`` deve estar normalizado (somar 1). Função pura e barata,
    pensada para ser chamada muitas vezes na varredura de sensibilidade.
    """
    preference_index = np.tensordot(weights, pref_matrices, axes=(0, 0))
    n = preference_index.shape[0]
    phi_plus = preference_index.sum(axis=1) / (n - 1)
    phi_minus = preference_index.sum(axis=0) / (n - 1)
    return preference_index, phi_plus, phi_minus, phi_plus - phi_minus


def compute_flows(
    matrix: np.ndarray,
    criteria: list[CriterionSpec],
) -> FlowResult:
    """Calcula todos os fluxos a partir da matriz de avaliação.

    Parameters
    ----------
    matrix : np.ndarray
        Matriz de avaliação ``(n alternativas, m critérios)``.
    criteria : list[CriterionSpec]
        Um spec por coluna de ``matrix``.

    Returns
    -------
    FlowResult
    """
    matrix = np.asarray(matrix, dtype=float)
    n, m = matrix.shape
    if n < 2:
        raise ValueError("São necessárias ao menos 2 alternativas.")
    if m != len(criteria):
        raise ValueError(
            f"Nº de critérios ({len(criteria)}) difere das colunas da matriz ({m})."
        )

    weights = normalize_weights(criteria)
    pref_matrices = criterion_preference_matrices(matrix, criteria)

    preference_index, phi_plus, phi_minus, phi_net = flows_from_preference_matrices(
        pref_matrices, weights
    )

    # fluxo líquido unicritério (normalizado por n-1) para o GAIA
    unicriterion_flows = (
        pref_matrices.sum(axis=2) - pref_matrices.sum(axis=1)
    ).T / (n - 1)

    return FlowResult(
        phi_plus=phi_plus,
        phi_minus=phi_minus,
        phi_net=phi_net,
        preference_index=preference_index,
        unicriterion_flows=unicriterion_flows,
        weights=weights,
    )
