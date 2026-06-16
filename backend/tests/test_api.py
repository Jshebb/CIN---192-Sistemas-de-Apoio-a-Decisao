"""Testes de integração da API (/solve, /export)."""

import csv
import io

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

PAYLOAD = {
    "alternatives": ["A", "B", "C"],
    "criteria": [
        {"name": "Custo", "weight": 0.6, "maximize": False, "preference": "usual"},
        {"name": "Qualidade", "weight": 0.4, "maximize": True, "preference": "v_shape", "p": 5.0},
    ],
    "matrix": [
        [250.0, 16.0],
        [200.0, 24.0],
        [300.0, 20.0],
    ],
}


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_solve_returns_ranking_and_gaia():
    resp = client.post("/api/solve", json=PAYLOAD)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["scores"]) == 3
    ranks = sorted(s["rank"] for s in data["scores"])
    assert ranks == [1, 2, 3]
    assert data["gaia"] is not None
    assert 0.0 <= data["gaia"]["quality"] <= 1.0


def test_solve_matches_reference_values():
    resp = client.post("/api/solve", json=PAYLOAD)

    assert resp.status_code == 200
    data = resp.json()
    assert [score["name"] for score in data["scores"]] == ["B", "A", "C"]
    assert [score["rank"] for score in data["scores"]] == [1, 2, 3]
    assert [score["phi_net"] for score in data["scores"]] == pytest.approx([0.96, -0.36, -0.60])
    np.testing.assert_allclose(
        data["preference_index"],
        [
            [0.0, 0.0, 0.6],
            [1.0, 0.0, 0.92],
            [0.32, 0.0, 0.0],
        ]
    )


def test_solve_validation_error():
    bad = {**PAYLOAD, "matrix": [[1.0]]}  # dimensões inconsistentes
    assert client.post("/api/solve", json=bad).status_code == 422


def test_solve_validation_error_for_inconsistent_thresholds():
    bad = {
        **PAYLOAD,
        "criteria": [
            {"name": "Custo", "weight": 1.0, "preference": "linear", "q": 2.0, "p": 2.0}
        ],
    }

    resp = client.post("/api/solve", json=bad)

    assert resp.status_code == 422
    assert "p deve ser > q" in resp.text


def test_cors_allows_local_frontend_origin():
    resp = client.options(
        "/api/solve",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == "http://localhost:3000"


def _csv_section(content: str, title: str) -> list[dict[str, str]]:
    """Extrai as linhas (como dicts) da seção que começa em ``# <title>``."""
    lines = content.splitlines()
    start = next(i for i, ln in enumerate(lines) if ln.startswith(title))
    block = []
    for ln in lines[start + 1 :]:
        if ln == "" or ln.startswith("#"):
            break
        block.append(ln)
    return list(csv.DictReader(io.StringIO("\n".join(block))))


def test_export_csv_has_full_model_and_ranking():
    resp = client.post("/api/export/csv", json={**PAYLOAD, "name": "Estudo X"})
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    content = resp.content.decode("utf-8-sig")

    # relatório completo: critérios, matriz, ranking e índice π
    assert "# Critérios" in content
    assert "# Matriz de avaliação" in content
    assert "Estudo X" in content

    ranking = _csv_section(content, "# Ranking")
    assert [row["Alternativa"] for row in ranking] == ["B", "A", "C"]
    assert [row["Rank"] for row in ranking] == ["1", "2", "3"]
    assert ranking[0]["Phi (líquido)"] == "0.9600"

    criteria = _csv_section(content, "# Critérios")
    assert {row["Critério"] for row in criteria} == {"Custo", "Qualidade"}


def test_export_pdf():
    resp = client.post("/api/export/pdf", json=PAYLOAD)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"


def test_sensitivity_returns_interval_per_criterion():
    resp = client.post("/api/sensitivity", json=PAYLOAD)
    assert resp.status_code == 200
    data = resp.json()
    assert data["base_order"] == ["B", "A", "C"]
    assert [c["name"] for c in data["criteria"]] == ["Custo", "Qualidade"]
    for c in data["criteria"]:
        # intervalos coerentes e contendo o peso atual
        assert 0.0 <= c["rank_lower"] <= c["weight"] <= c["rank_upper"] <= 1.0
        assert c["winner_lower"] <= c["weight"] <= c["winner_upper"]
        # estabilidade do 1º colocado é ao menos tão ampla quanto a do ranking
        assert c["winner_lower"] <= c["rank_lower"]
        assert c["winner_upper"] >= c["rank_upper"]


def test_duplicate_criteria_names_rejected():
    bad = {
        **PAYLOAD,
        "criteria": [
            {"name": "Custo", "weight": 0.5, "preference": "usual"},
            {"name": "Custo", "weight": 0.5, "preference": "usual"},
        ],
        "matrix": [[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]],
    }
    resp = client.post("/api/solve", json=bad)
    assert resp.status_code == 422
    assert "critérios devem ser únicos" in resp.text
