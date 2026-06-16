"""Camada de serviço — traduz o contrato da API para o núcleo MCDM e volta.

Mantém as rotas finas: nenhuma lógica de FastAPI vaza para o ``core/``.
"""

from __future__ import annotations

import numpy as np

from ..core.flows import CriterionSpec
from ..core.gaia import compute_gaia
from ..core.promethee_ii import rank
from ..core.sensitivity import weight_stability
from ..schemas import (
    CriterionStabilityOutput,
    GaiaOutput,
    GaiaPoint,
    ScoreOutput,
    SensitivityResponse,
    SolveRequest,
    SolveResponse,
)


def _to_specs(req: SolveRequest) -> list[CriterionSpec]:
    return [
        CriterionSpec(
            name=c.name,
            weight=c.weight,
            maximize=c.maximize,
            preference=c.preference,
            q=c.q,
            p=c.p,
            s=c.s,
        )
        for c in req.criteria
    ]


def solve(req: SolveRequest) -> SolveResponse:
    """Resolve o problema e monta a resposta completa (ranking + GAIA)."""
    matrix = np.asarray(req.matrix, dtype=float)
    specs = _to_specs(req)

    result = rank(matrix, specs, req.alternatives)

    scores = [
        ScoreOutput(
            name=s.name,
            phi_plus=s.phi_plus,
            phi_minus=s.phi_minus,
            phi_net=s.phi_net,
            rank=s.rank,
        )
        for s in result.scores
    ]

    gaia: GaiaOutput | None = None
    if len(req.criteria) >= 2:
        g = compute_gaia(result.flows.unicriterion_flows, result.flows.weights)
        gaia = GaiaOutput(
            alternatives=[
                GaiaPoint(name=req.alternatives[i], x=float(g.alternatives[i, 0]), y=float(g.alternatives[i, 1]))
                for i in range(len(req.alternatives))
            ],
            criteria=[
                GaiaPoint(name=req.criteria[k].name, x=float(g.criteria[k, 0]), y=float(g.criteria[k, 1]))
                for k in range(len(req.criteria))
            ],
            decision_axis=GaiaPoint(name="π", x=float(g.decision_axis[0]), y=float(g.decision_axis[1])),
            quality=g.quality,
        )

    return SolveResponse(
        scores=scores,
        gaia=gaia,
        preference_index=result.flows.preference_index.tolist(),
    )


def sensitivity(req: SolveRequest) -> SensitivityResponse:
    """Calcula os intervalos de estabilidade de peso de cada critério."""
    matrix = np.asarray(req.matrix, dtype=float)
    specs = _to_specs(req)
    result = weight_stability(matrix, specs)

    return SensitivityResponse(
        base_order=[req.alternatives[i] for i in result.base_order],
        criteria=[
            CriterionStabilityOutput(
                name=c.name,
                weight=c.weight,
                rank_lower=c.rank_lower,
                rank_upper=c.rank_upper,
                winner_lower=c.winner_lower,
                winner_upper=c.winner_upper,
            )
            for c in result.criteria
        ],
    )
