# PROMETHEE II — Apoio à Decisão Multicritério (MCDM/MCDA)

Aplicação web completa que implementa o método **PROMETHEE II** (ranking
completo) com visualização **GAIA**, permitindo que qualquer usuário resolva
problemas de decisão multicritério sem conhecimento técnico do método.

Projeto da **Fase 2 — Projetos de Desenvolvimento**.

## Artigos base

- **Brans, J.P. & Vincke, Ph. (1986).** *A Preference Ranking Organisation Method
  (The PROMETHEE Method for Multiple Criteria Decision-Making).* Management
  Science, 31(6), 647–656.
  <https://www.sciencedirect.com/science/article/abs/pii/0377221786900445>
- **Behzadian, M. et al. (2010).** *PROMETHEE: A comprehensive literature review
  on methodologies and applications.* European Journal of Operational Research.
  <https://www.sciencedirect.com/science/article/abs/pii/S0377221709000071>

## Funcionalidades

- Entrada intuitiva de **critérios** (peso, objetivo de max/min, função de
  preferência e limiares) e de **alternativas** (matriz de avaliação).
- Implementação completa do **PROMETHEE II**: fluxos φ⁺, φ⁻ e φ líquido, e
  ranking completo.
- As **6 funções de preferência** do artigo original (usual, U, V, nível,
  linear, gaussiana).
- **Plano GAIA** (PCA) com alternativas, vetores de critério e eixo de decisão π.
- Visualização do ranking (gráfico de barras de φ líquido).
- **Validação guiada** no frontend: erros de pesos, limiares q/p/s e nomes
  duplicados aparecem inline (e bloqueiam o cálculo) antes de chamar a API.
- **Análise de sensibilidade dos pesos**: intervalo de estabilidade de cada
  critério (de quanto o peso pode variar sem mudar o ranking / o 1º colocado).
- **Comparação de cenários** lado a lado: capture rankings com pesos diferentes
  e veja como cada alternativa se move.
- **Exportação** dos resultados em **CSV** e **PDF** — relatório completo com
  critérios, pesos, matriz, funções, limiares, ranking, índice π e GAIA.
- **API REST documentada** com Swagger/OpenAPI em `/docs`.

## Arquitetura

```
promethee/
├── backend/                  # FastAPI (Python)
│   ├── app/
│   │   ├── main.py           # app FastAPI + CORS + /health
│   │   ├── schemas.py        # contrato Pydantic (entrada/saída)
│   │   ├── api/
│   │   │   ├── routes.py     # /api/solve, /api/sensitivity, /api/export/{csv,pdf}
│   │   │   ├── service.py    # ponte API ↔ núcleo MCDM
│   │   │   └── export.py     # geração de CSV e PDF
│   │   └── core/             # núcleo MCDM (Python puro, sem FastAPI)
│   │       ├── preference_functions.py  # 6 funções de preferência
│   │       ├── flows.py                  # φ⁺, φ⁻, φ + fluxos unicritério
│   │       ├── promethee_ii.py           # ranking completo
│   │       ├── sensitivity.py            # intervalos de estabilidade de peso
│   │       └── gaia.py                   # projeção PCA → plano GAIA
│   └── tests/                # pytest (78 testes)
└── frontend/                 # Next.js + TypeScript + Tailwind
    └── src/
        ├── app/
        │   ├── page.tsx      # wizard (critérios → alternativas → resultado)
        │   └── components/   # RankingChart, GaiaPlane, SensitivityPanel, ScenarioComparison
        └── lib/
            ├── api.ts        # tipos + cliente da API
            └── validation.ts # validação guiada (pesos, limiares, nomes)
```

**Princípio de design:** o núcleo MCDM (`core/`) não importa nada de FastAPI —
é Python puro e testável isoladamente contra os números dos artigos. A API é
uma casca fina por cima.

## Como rodar localmente

### Pré-requisitos
- Python 3.11+ e Node.js 20+

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload    # http://localhost:8000
```

- Swagger/OpenAPI: <http://localhost:8000/docs>
- Healthcheck: <http://localhost:8000/health>

### Frontend (Next.js)

```bash
cd frontend
npm install
cp .env.example .env.local       # ajuste NEXT_PUBLIC_API_URL se necessário
npm run dev                      # http://localhost:3000
```

### Tudo de uma vez (Docker)

```bash
docker compose up --build        # backend :8000  ·  frontend :3000
```

### Testes

```bash
cd backend && pytest             # 78 testes
```

A suíte cobre funções de preferência, fluxos PROMETHEE, ranking, validação dos
schemas, camada de serviço, API, CORS, exportação CSV/PDF e plano GAIA.

## API

| Método | Rota                 | Descrição                                       |
|--------|----------------------|-------------------------------------------------|
| POST   | `/api/solve`         | Resolve via PROMETHEE II (ranking + GAIA)       |
| POST   | `/api/sensitivity`   | Intervalos de estabilidade de peso por critério |
| POST   | `/api/export/csv`    | Baixa o relatório completo em CSV               |
| POST   | `/api/export/pdf`    | Baixa o relatório completo em PDF               |
| GET    | `/health`            | Healthcheck                                     |
| GET    | `/docs`              | Documentação interativa (Swagger)               |

Exemplo de payload (`POST /api/solve`):

```json
{
  "alternatives": ["Carro A", "Carro B", "Carro C"],
  "criteria": [
    { "name": "Preço", "weight": 0.6, "maximize": false, "preference": "linear", "q": 5, "p": 20 },
    { "name": "Conforto", "weight": 0.4, "maximize": true, "preference": "v_shape", "p": 3 }
  ],
  "matrix": [[80, 7], [65, 5], [95, 9]]
}
```

### Funções de preferência e seus parâmetros

| Tipo        | Valor (`preference`) | Parâmetros |
|-------------|----------------------|------------|
| I — Usual   | `usual`              | —          |
| II — Quase  | `u_shape`            | `q`        |
| III — Linear (V) | `v_shape`       | `p`        |
| IV — Nível  | `level`              | `q`, `p`   |
| V — Linear c/ indiferença | `linear`| `q`, `p`   |
| VI — Gaussiana | `gaussian`        | `s`        |

## Deploy

- **Frontend → Vercel**: importe o repositório, defina *Root Directory* =
  `frontend` e a variável `NEXT_PUBLIC_API_URL` apontando para a URL pública da
  API no Render (sem barra final, ex.: `https://<sua-api>.onrender.com`).
  Como é uma variável `NEXT_PUBLIC_`, ela é embutida no build — após alterá-la é
  preciso **refazer o deploy** na Vercel.
- **Backend → Render**: importe o repositório, *Root Directory* = `backend`
  (usa `railway.json` / `Procfile` / `Dockerfile`; `PORT` é injetado pelo Render)
  e defina `CORS_ORIGINS` com a URL do frontend na Vercel (várias separadas por
  vírgula). Sem `CORS_ORIGINS`, o navegador bloqueia as requisições por CORS.

## O método PROMETHEE II (resumo)

1. Para cada par de alternativas e cada critério, calcula-se o grau de
   preferência `P_k(a,b)` via função de preferência.
2. Índice de preferência agregado `π(a,b) = Σ wₖ·Pₖ(a,b)` (pesos normalizados).
3. Fluxos: `φ⁺(a) = média de π(a,·)`, `φ⁻(a) = média de π(·,a)`.
4. Fluxo líquido `φ(a) = φ⁺(a) − φ⁻(a)` → **ranking completo** (maior φ = melhor).
5. **GAIA**: projeção PCA dos fluxos unicritério num plano 2D para análise visual.

## Equipe

- João Henrique Silva Ebbers
- Thiago Felipe
- Humberto Campos
- Gustavo Silva Nogueira

## 📜 Licença

Uso acadêmico.
