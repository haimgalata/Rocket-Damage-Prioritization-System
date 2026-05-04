# PrioritAI

Rocket damage **prioritization** for municipal operations: field photos are classified for severity, combined with **geographic context** (critical infrastructure and population), and surfaced on a **ranked dashboard** for response planning.

> **Note:** The vision model is **experimental** and expected to change across releases. Treat scores as decision-support, not ground truth.

---

## Project overview

PrioritAI supports a three-tier role model (**Super Admin**, **Admin**, **Operator**). Operators submit damage events (image + GPS). The API runs **damage classification** immediately, persists the event, then completes **GIS enrichment** asynchronously. **Admins** manage visibility and workflow status; **Super Admins** work across organizations.

---

## System architecture

```mermaid
flowchart LR
  subgraph client [Web client]
    React[React TypeScript SPA]
  end
  subgraph backend [Backend]
    API[FastAPI API]
    GIS[GIS pipeline OSM CBS]
    DB[(PostgreSQL)]
    Storage[Supabase Storage optional]
  end
  subgraph ml [ML service]
    MLAPI[FastAPI predict]
    TF[TensorFlow Keras]
  end
  React -->|JWT REST| API
  API -->|HTTP predict raw image| MLAPI
  MLAPI --> TF
  API --> GIS
  API --> DB
  API --> Storage
```

- **Frontend (`client/`):** Vite + React + TypeScript; calls the API using `VITE_API_URL` (local dev: backend origin; Docker: `/api` behind Nginx).
- **Backend (`server/`):** FastAPI, SQLAlchemy models, JWT auth, event CRUD, GIS orchestration, priority scoring, optional Groq-backed narrative explanations.
- **ML service (`ml-service/`):** Separate container or Cloud Run service exposing `POST /predict` (raw image body) and `GET /health`. Keeps TensorFlow **out of** the main API image ([server/Dockerfile](server/Dockerfile)).
- **Database:** PostgreSQL (local Docker or hosted, e.g. Supabase). Schema is created via SQLAlchemy `create_all` (no Alembic migrations in-repo).
- **Object storage:** Event images can be uploaded to Supabase Storage (`event-images` bucket); legacy `/uploads/` paths may still exist for older rows.

Deeper file-level maps, formulas, and DB tables: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Data flow (pipeline)

1. **Submit event** — `POST /events` (multipart): coordinates, text, optional tags, optional image (stored per your storage configuration).
2. **Classification** — Backend sends image bytes to **ML service** `POST /predict`. Response: `Heavy` / `Light`, integer **damage_score** (e.g. 7 / 3), `confidence`. If the service is down, a **randomized fallback** is used ([server/src/core/ai_fallback.py](server/src/core/ai_fallback.py)) and should be treated as non-production behavior.
3. **Persist** — Event + initial analysis row; `gisStatus` indicates pending GIS.
4. **GIS (background)** — For the event coordinates: distances to hospital, school, road, military/strategic feature (OSM via Overpass/osmnx patterns), plus **population density** from **CBS** statistical areas + population tables. Results cached per rounded lat/lon.
5. **Priority** — Weighted formula combines damage score with GIS-derived multiplier; clamped score and explanation text updated in the database.
6. **Dashboard** — Clients poll `GET /events/{id}` until GIS completes; lists and maps use `GET /events`.

---

## Tech stack

| Layer | Technologies |
|--------|----------------|
| API | Python 3.11, FastAPI, Uvicorn, SQLAlchemy 2, psycopg2, Pydantic |
| Auth | JWT (`JWT_SECRET`) |
| GIS / geo | OSM / Overpass (via project wrappers), CBS shapefile + Excel, Shapely / pyogrio ecosystem |
| ML | TensorFlow Keras (`.keras` weights), PIL, NumPy |
| Frontend | React 18+, TypeScript, Vite, Tailwind, Leaflet, Zustand |
| Ops | Docker Compose, Nginx (frontend image), Render blueprint ([render.yaml](render.yaml)) |

---

## Setup

### Prerequisites

- Docker + Docker Compose **or** local Node 20+, Python 3.11+, PostgreSQL 16.
- For full functionality: Supabase (or compatible) for `DATABASE_URL`, storage keys if using uploads, optional `GROQ_API_KEY` for LLM explanations, and a running **ML service** URL for real inference.

### Local development (without Docker for API)

1. Copy environment template: `cp .env.example .env` and set `DATABASE_URL`, `SUPABASE_*` if used, `JWT_SECRET`, `ML_SERVICE_URL`, optional `ML_SERVICE_API_KEY`, `GROQ_API_KEY`.
2. **PostgreSQL** running and reachable from `DATABASE_URL`.
3. Backend (from repo root): `uvicorn server.src.main:app --reload --host 0.0.0.0 --port 8000` (or `python -m server.src.main`). Ensure `ML_SERVICE_URL` points at a running [ml-service](ml-service/) instance (e.g. `http://127.0.0.1:8080`).
4. Frontend: `cd client && npm ci && npm run dev` — set `VITE_API_URL=http://localhost:8000` in `.env` or shell.
5. Seed reference data and demo content: `python -m server.src.seed_db` (see Docker below for the container one-liner).

**Note:** [server/src/main.py](server/src/main.py) does not call `load_dotenv()`; Compose injects `env_file: .env`. For bare `uvicorn`, export variables or use a tool that loads `.env`.

### Docker (Compose)

From repo root:

```bash
docker compose up --build
```

When running **locally with Docker**, set repo-root `.env` for services that read it (mainly the backend): `DATABASE_URL=postgresql://prioritai:prioritai@postgres:5432/prioritai` (hostname `postgres` is the Compose database service), `ML_SERVICE_URL=http://ml-service:8080` (`ml-service` is the ML container), and `VITE_API_URL=/api` so the browser uses Nginx’s `/api` proxy. These values are for Compose only and differ from production (Supabase, Render, Cloud Run).

- **Frontend:** http://localhost (Nginx → SPA; `/api` proxied to backend).
- **Backend API:** http://localhost:8000 — OpenAPI docs at `/docs`.
- **Postgres:** port `5432` (dev credentials in [docker-compose.yml](docker-compose.yml)).
- **ML service:** port `8080`; Compose sets `ML_SERVICE_URL=http://ml-service:8080` on the backend so CNN inference works without extra `.env` wiring.

Populate the database after the stack is up:

```bash
docker exec -it prioritai-backend python -m server.src.seed_db
```

Seeded events use **`/uploads/…`** image URLs from [server/seed_events.json](server/seed_events.json). Keep the matching demo JPGs in repo-root **`uploads/`** (see [.gitignore](.gitignore) for allowed filenames) so thumbnails load when running locally without Supabase-hosted images.

Optional helper: [start.sh](start.sh) wraps `docker compose up` and waits for health (bash / Git Bash / WSL).

### ML service only (local binary)

```bash
cd ml-service
docker build -t prioritai-ml .
docker run --rm -p 8080:8080 prioritai-ml
```

Expose port **8080** (or override `ML_SERVICE_URL`). Optional `ML_SERVICE_API_KEY` must match `X-API-Key` on requests ([ml-service/app/main.py](ml-service/app/main.py)).

---

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `SUPABASE_URL`, `SUPABASE_KEY` | Backend | Storage uploads (`event-images`) |
| `JWT_SECRET` | Backend | Signing key for access tokens (**required in production**) |
| `ML_SERVICE_URL` | Backend | Base URL of ML service (no trailing slash); Compose overrides to `http://ml-service:8080` |
| `ML_SERVICE_API_KEY` | Backend + ML service | Optional shared secret header |
| `ML_SERVICE_CONNECT_TIMEOUT`, `ML_SERVICE_READ_TIMEOUT` | Backend | HTTP client timeouts |
| `GROQ_API_KEY` | Backend | Optional LLM explanations |
| `CORS_ORIGINS` | Backend | Comma-separated extra allowed origins |
| `VITE_API_URL` | Client build | Browser-visible API base URL |

Templates: [.env.example](.env.example), [server/.env.example](server/.env.example). Use placeholders only; never commit real secrets.

---

## API overview (high level)

All business routes use **Bearer JWT** unless noted.

| Area | Methods | Purpose |
|------|---------|---------|
| Health | `GET /health` | Liveness |
| Auth | `POST /auth/login`, `GET /auth/me`, `PATCH /auth/password`, `GET/POST /auth/users` | Session and user admin |
| Organizations | `GET/POST /organizations` | Org listing / create (super admin) |
| Settlements | `GET /settlements` | Reference geography |
| Events | `POST /events`, `GET /events`, `GET /events/{id}`, `PATCH /events/{id}`, `DELETE /events/{id}` | Core workflow |
| Analyze | `POST /analyze` | Synchronous full pipeline (testing / Model Runner) |

Interactive schema: `/docs` on the API host.

---

## ML model

- **What it does:** Binary **damage severity** classification (**Heavy** vs **Light**) from a RGB image, mapped to discrete **damage_score** values used in the priority formula. Output includes **confidence** from softmax.
- **Evolving:** Architecture, weights, and training data may change; version **in code** (e.g. `ai_model` field) may not track every experiment.
- **Data / training:** **Training scripts and datasets are not part of this application repo** as shipped here; the service loads a bundled **`.keras`** artifact ([ml-service/model/](ml-service/model/)). If you use **synthetic or augmented** imagery for training, document that in `docs/ml.md` (optional) or your paper — do not claim specifics in the README that are not published with the repo.

---

## GIS logic (summary)

- **Infrastructure proximity:** For each coordinate, query OpenStreetMap-derived features and compute distances (meters) to nearest **hospital**, **school**, **road**, and **military / helipad**-style strategic sites (see modules under [server/src/services/gis/proximity/](server/src/services/gis/proximity/)).
- **Population density:** Point-in-polygon against **CBS** statistical area shapefiles joined to population tables ([server/data/cbs_data/](server/data/cbs_data/)), expressed as people per km².
- **Scoring:** Distances feed **piecewise coefficients**; weighted sum forms a geographic multiplier combined with `damage_score` ([server/src/core/priority_logic.py](server/src/core/priority_logic.py)). Isolation / “not found” distances map to penalties.
- **Performance / resilience:** In-memory cache by rounded coordinates; parallel extraction with per-task timeouts in the pipeline ([server/src/services/gis/gis_pipeline.py](server/src/services/gis/gis_pipeline.py)). External Overpass rate limits remain an operational concern.

---

## Future improvements

- **Migrations:** Introduce Alembic (or equivalent) instead of `create_all` only.
- **Config:** Centralize settings (e.g. Pydantic `BaseSettings`), respect `LOG_LEVEL` from env ([server/src/main.py](server/src/main.py) currently sets `DEBUG` logging unconditionally).
- **ML ops:** Model registry, versioned artifacts, metrics, and integration tests that **mock** the ML HTTP boundary.
- **Security:** Remove default `JWT_SECRET`, rotate keys, tighten CORS defaults for production, rate-limit auth.
- **Observability:** Structured logging, request IDs, RED metrics, GIS/Overpass latency dashboards.

---

## License and attribution

See [LICENSE](LICENSE). CBS and OpenStreetMap data carry their own licenses; cite them when redistributing boundary or map-derived datasets.

---

## Contributing

Issues and PRs welcome. Run server tests from repo root:

```bash
pytest server/tests
```

Ensure the repository root is on `PYTHONPATH` if imports fail. Keep **secrets** out of git.
