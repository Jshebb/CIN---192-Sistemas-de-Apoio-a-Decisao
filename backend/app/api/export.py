"""Exportação dos resultados em CSV e PDF.

Os relatórios são *completos*: além do ranking, documentam o modelo de
decisão (critérios, pesos, objetivos, funções de preferência e limiares),
a matriz de avaliação, o índice de preferência agregado π e a qualidade
do plano GAIA — o suficiente para auditar/reproduzir a recomendação.
"""

from __future__ import annotations

import csv
import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from ..schemas import SolveRequest, SolveResponse

_RANK_HEADERS = ["Rank", "Alternativa", "Phi+", "Phi-", "Phi (líquido)"]

# Rótulos curtos das funções de preferência para os relatórios.
_PREF_LABELS = {
    "usual": "I — Usual",
    "u_shape": "II — Quase (U)",
    "v_shape": "III — Linear (V)",
    "level": "IV — Nível",
    "linear": "V — Linear c/ indif.",
    "gaussian": "VI — Gaussiana",
}


def _rank_rows(result: SolveResponse) -> list[list[str]]:
    ordered = sorted(result.scores, key=lambda s: s.rank)
    return [
        [str(s.rank), s.name, f"{s.phi_plus:.4f}", f"{s.phi_minus:.4f}", f"{s.phi_net:.4f}"]
        for s in ordered
    ]


def _fmt(value: float | None) -> str:
    return "" if value is None else f"{value:g}"


def _criteria_rows(request: SolveRequest) -> tuple[list[str], list[list[str]]]:
    total = sum(c.weight for c in request.criteria) or 1.0
    header = ["Critério", "Peso", "Peso norm.", "Objetivo", "Função", "q", "p", "s"]
    rows = [
        [
            c.name,
            f"{c.weight:g}",
            f"{c.weight / total:.3f}",
            "Maximizar" if c.maximize else "Minimizar",
            _PREF_LABELS.get(c.preference.value, c.preference.value),
            _fmt(c.q),
            _fmt(c.p),
            _fmt(c.s),
        ]
        for c in request.criteria
    ]
    return header, rows


def _matrix_rows(request: SolveRequest) -> tuple[list[str], list[list[str]]]:
    header = ["Alternativa", *[c.name for c in request.criteria]]
    rows = [
        [name, *[f"{v:g}" for v in request.matrix[i]]]
        for i, name in enumerate(request.alternatives)
    ]
    return header, rows


def _pref_index_rows(request: SolveRequest, result: SolveResponse) -> tuple[list[str], list[list[str]]]:
    names = request.alternatives
    header = ["π(a, b)", *names]
    rows = [
        [names[i], *[f"{v:.3f}" for v in row]]
        for i, row in enumerate(result.preference_index)
    ]
    return header, rows


def to_csv(request: SolveRequest, result: SolveResponse) -> bytes:
    """Gera um CSV com o modelo de decisão completo e o ranking."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    writer.writerow(["PROMETHEE II", request.name or ""])
    writer.writerow([])

    writer.writerow(["# Critérios"])
    crit_header, crit_rows = _criteria_rows(request)
    writer.writerow(crit_header)
    writer.writerows(crit_rows)
    writer.writerow([])

    writer.writerow(["# Matriz de avaliação"])
    mat_header, mat_rows = _matrix_rows(request)
    writer.writerow(mat_header)
    writer.writerows(mat_rows)
    writer.writerow([])

    writer.writerow(["# Ranking"])
    writer.writerow(_RANK_HEADERS)
    writer.writerows(_rank_rows(result))
    writer.writerow([])

    writer.writerow(["# Índice de preferência agregado (pi)"])
    pi_header, pi_rows = _pref_index_rows(request, result)
    writer.writerow(pi_header)
    writer.writerows(pi_rows)

    if result.gaia is not None:
        writer.writerow([])
        writer.writerow(["# GAIA"])
        writer.writerow(["Qualidade (delta)", f"{result.gaia.quality:.4f}"])

    return buffer.getvalue().encode("utf-8-sig")  # BOM p/ Excel abrir acentos


def _styled(data: list[list[str]], align_first_left: bool = True) -> Table:
    """Aplica o estilo visual padrão dos relatórios a uma tabela."""
    table = Table(data, hAlign="LEFT")
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
    ]
    if align_first_left:
        style.append(("ALIGN", (0, 0), (0, -1), "LEFT"))
    table.setStyle(TableStyle(style))
    return table


def to_pdf(request: SolveRequest, result: SolveResponse) -> bytes:
    """Gera um relatório PDF completo do estudo PROMETHEE II."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        title="Relatório PROMETHEE II",
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )
    styles = getSampleStyleSheet()
    elements: list = [Paragraph("Relatório — PROMETHEE II", styles["Title"])]
    if request.name:
        elements.append(Paragraph(request.name, styles["Heading2"]))
    elements.append(
        Paragraph(
            f"{len(request.alternatives)} alternativas · {len(request.criteria)} critérios",
            styles["Normal"],
        )
    )
    elements.append(Spacer(1, 14))

    def section(title: str, header_rows: tuple[list[str], list[list[str]]]) -> None:
        header, rows = header_rows
        elements.append(Paragraph(title, styles["Heading3"]))
        elements.append(Spacer(1, 4))
        elements.append(_styled([header] + rows))
        elements.append(Spacer(1, 14))

    section("Critérios e parâmetros", _criteria_rows(request))
    section("Matriz de avaliação", _matrix_rows(request))

    elements.append(Paragraph("Ranking (PROMETHEE II)", styles["Heading3"]))
    elements.append(Spacer(1, 4))
    elements.append(_styled([_RANK_HEADERS] + _rank_rows(result)))
    elements.append(Spacer(1, 14))

    section("Índice de preferência agregado π", _pref_index_rows(request, result))

    if result.gaia is not None:
        elements.append(
            Paragraph(
                f"Qualidade do plano GAIA (δ): {result.gaia.quality:.2%} "
                "— fração da variância preservada na projeção 2D.",
                styles["Normal"],
            )
        )

    doc.build(elements)
    return buffer.getvalue()
