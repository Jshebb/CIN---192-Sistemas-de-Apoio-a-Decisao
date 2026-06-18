"""Schemas Pydantic — contrato da API (entrada e saída do /solve)."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator, model_validator

from .core.preference_functions import PreferenceType


class CriterionInput(BaseModel):
    """Definição de um critério vinda do frontend."""

    name: str = Field(..., min_length=1, examples=["Preço"])
    weight: float = Field(..., gt=0, examples=[0.3])
    maximize: bool = Field(True, description="True = maior é melhor; False = menor é melhor")
    preference: PreferenceType = Field(PreferenceType.USUAL)
    q: float | None = Field(None, description="Limiar de indiferença (tipos II, IV, V)")
    p: float | None = Field(None, description="Limiar de preferência (tipos III, IV, V)")
    s: float | None = Field(None, description="Sigma da gaussiana (tipo VI)")

    @model_validator(mode="after")
    def _check_required_params(self) -> "CriterionInput":
        needs_q = {PreferenceType.U_SHAPE, PreferenceType.LEVEL, PreferenceType.LINEAR}
        needs_p = {PreferenceType.V_SHAPE, PreferenceType.LEVEL, PreferenceType.LINEAR}
        if self.preference in needs_q and self.q is None:
            raise ValueError(f"Critério '{self.name}': parâmetro q é obrigatório para {self.preference.value}")
        if self.preference in needs_p and self.p is None:
            raise ValueError(f"Critério '{self.name}': parâmetro p é obrigatório para {self.preference.value}")
        if self.preference == PreferenceType.GAUSSIAN and self.s is None:
            raise ValueError(f"Critério '{self.name}': parâmetro s é obrigatório para gaussian")
        return self


class SolveRequest(BaseModel):
    """Requisição para resolver um problema PROMETHEE II."""

    alternatives: list[str] = Field(..., min_length=2, examples=[["Carro A", "Carro B", "Carro C"]])
    criteria: list[CriterionInput] = Field(..., min_length=1)
    matrix: list[list[float]] = Field(
        ...,
        description="Matriz de avaliação (linhas = alternativas, colunas = critérios)",
        examples=[[[250.0, 16.0], [200.0, 24.0], [300.0, 20.0]]],
    )

    @model_validator(mode="after")
    def _check_dimensions(self) -> "SolveRequest":
        n, m = len(self.alternatives), len(self.criteria)
        if len(self.matrix) != n:
            raise ValueError(f"A matriz tem {len(self.matrix)} linhas, esperado {n} (alternativas).")
        for i, row in enumerate(self.matrix):
            if len(row) != m:
                raise ValueError(f"Linha {i} tem {len(row)} valores, esperado {m} (critérios).")
        return self

    @field_validator("alternatives")
    @classmethod
    def _unique_alternatives(cls, v: list[str]) -> list[str]:
        if len(set(v)) != len(v):
            raise ValueError("Nomes de alternativas devem ser únicos.")
        return v

    @field_validator("criteria")
    @classmethod
    def _unique_criteria(cls, v: list[CriterionInput]) -> list[CriterionInput]:
        names = [c.name for c in v]
        if len(set(names)) != len(names):
            raise ValueError("Nomes de critérios devem ser únicos.")
        return v


class ScoreOutput(BaseModel):
    name: str
    phi_plus: float
    phi_minus: float
    phi_net: float
    rank: int


class GaiaPoint(BaseModel):
    name: str
    x: float
    y: float


class GaiaOutput(BaseModel):
    alternatives: list[GaiaPoint]
    criteria: list[GaiaPoint]
    decision_axis: GaiaPoint
    quality: float = Field(..., description="δ: fração da variância preservada no plano")


class SolveResponse(BaseModel):
    """Resposta do /solve com ranking PROMETHEE II e plano GAIA."""

    scores: list[ScoreOutput]
    gaia: GaiaOutput | None = None
    preference_index: list[list[float]] = Field(
        ..., description="Índice de preferência agregado π (n×n)"
    )
