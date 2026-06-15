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


def test_export_csv():
    resp = client.post("/api/export/csv", json=PAYLOAD)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert b"Rank" in resp.content
    content = resp.content.decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(content)))
    assert [row["Alternativa"] for row in rows] == ["B", "A", "C"]
    assert [row["Rank"] for row in rows] == ["1", "2", "3"]
    assert rows[0]["Phi (líquido)"] == "0.9600"


def test_export_pdf():
    resp = client.post("/api/export/pdf", json=PAYLOAD)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"
