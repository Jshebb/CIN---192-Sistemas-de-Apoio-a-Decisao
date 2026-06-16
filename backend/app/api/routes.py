"""Rotas da API REST."""

from __future__ import annotations

from fastapi import APIRouter, Response

from ..schemas import SensitivityResponse, SolveRequest, SolveResponse
from . import export, service

router = APIRouter(prefix="/api", tags=["promethee"])


@router.post("/solve", response_model=SolveResponse, summary="Resolver via PROMETHEE II")
def solve(request: SolveRequest) -> SolveResponse:
    """Executa o PROMETHEE II e devolve ranking, fluxos e plano GAIA."""
    return service.solve(request)


@router.post(
    "/sensitivity",
    response_model=SensitivityResponse,
    summary="Análise de sensibilidade dos pesos",
)
def sensitivity(request: SolveRequest) -> SensitivityResponse:
    """Intervalos de estabilidade de peso (ranking e 1º colocado) por critério."""
    return service.sensitivity(request)


@router.post("/export/csv", summary="Exportar relatório completo em CSV")
def export_csv(request: SolveRequest) -> Response:
    result = service.solve(request)
    content = export.to_csv(request, result)
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=promethee_ii.csv"},
    )


@router.post("/export/pdf", summary="Exportar relatório completo em PDF")
def export_pdf(request: SolveRequest) -> Response:
    result = service.solve(request)
    content = export.to_pdf(request, result)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=promethee_ii.pdf"},
    )
