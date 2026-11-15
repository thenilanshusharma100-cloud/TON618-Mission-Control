# TON618 — Mission Control

A NASA Space Apps mission-design game. The player assembles a spacecraft, plans its orbit, runs the mission, and receives a scored report. Solo developer, emergency MVP sprint — favour complete working vertical slices over breadth. No auth, no decorative features.

## Status

- **B1–B5**: Complete and gate-verified.
- **B6**: Production readiness — in progress.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, TypeScript 7, Tailwind CSS v4, TanStack Query |
| Backend | Python 3.14, FastAPI, Pydantic, SQLAlchemy 2 |
| Database | SQLite (`backend/var/ton618.db`), created and seeded on startup |
| Units | Pint; all internal physical values are SI, converted only for display |
| Tests | pytest (backend), Vitest + Testing Library (frontend) |
| Linting | Ruff (backend), oxlint (frontend), `tsc -b` type checking |
| Physics | All calculations in SI base units via Pint. Educational assumptions clearly labelled. |

## Architecture and key files

| Layer | Key Files |
|---|---|
| Frontend | `frontend/src/` — React pages, components, lib, API client <br> `frontend/vite.config.ts` — dev proxy + API base URL |
| Backend | `backend/app/main.py` — FastAPI app with CORS <br> `backend/app/core/config.py` — settings (env vars) <br> `backend/app/services/` — budget/simulation/orbit logic <br> `backend/app/models/` — SQLAlchemy models <br> `backend/app/api/routes/` — API endpoints <br> `backend/app/db/` — seeding, schema |
| Data | `data/reference/` — cited constants (source URL + original units) <br> `data/catalog/` — 15 estimated components (no source) <br> `data/missions/` — mission profiles |

## Quickstart (Windows, PowerShell)

### Backend

```powershell
cd backend
uv sync
# Optionally: copy .env.example to .env and adjust values
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend (second terminal)

```powershell
cd frontend
npm install
# Optionally: copy .env.example to .env and adjust VITE_API_BASE_URL
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the backend, so no CORS setup is needed during proxy-based development. Direct cross-origin access is controlled by `TON618_CORS_ORIGINS`.

### Production deployment

1. Set `VITE_API_BASE_URL` to your backend URL in `frontend/.env`.
2. Set environment variables in `backend/.env` (see below).
3. Run the backend: `uv run uvicorn app.main:app --port 8000`.
4. Run the frontend: `npm run preview` (serves `frontend/dist/`).
5. Or deploy the `frontend/dist/` static bundle to your hosting provider, pointing the `/api` proxy to your backend.

### Environment variables

#### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `TON618_DATABASE_URL` | `sqlite:///./var/ton618.db` | SQLite database path |
| `TON618_CATALOG_DIR` | `../data` | Reference data and component catalog directory |
| `TON618_APP_NAME` | `TON618 Mission Control` | App name |
| `TON618_APP_VERSION` | `0.1.0` | App version |
| `TON618_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed origins |

#### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | Backend origin; used as the dev proxy target and as `<origin>/api` for production builds |

### API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | DB probe, version, unit system |
| GET | `/api/missions` | Mission profiles and budgets |
| GET | `/api/components` | Component catalog, optional `?category=` filter |
| GET | `/api/components/{id}` | Component detail with provenance |
| POST | `/api/design/calculate` | Totals, remaining budgets, category breakdown |
| POST | `/api/design/validate` | Calculation plus `valid` flag and violations |
| GET | `/api/designs[?mission_slug=]` | Saved designs, newest first |
| POST | `/api/designs` | Create a saved design |
| GET | `/api/designs/{id}` | Load a saved design |
| PUT | `/api/designs/{id}` | Rename and replace a saved design's items |
| POST | `/api/simulation/analyze` | Run mission simulation and return scored report |

Design request body:

```json
{
  "mission_slug": "earthwatch-01",
  "items": [{ "component_id": 1, "quantity": 1 }]
}
```

Saved-design create adds `name`; update omits `mission_slug`. Totals are SI; costs are integer USD. Violations: `EMPTY_DESIGN`, `MASS_OVER_BUDGET`, `POWER_MARGIN_LOW`, `COST_OVER_BUDGET`, `MISSING_REQUIRED_CATEGORY`.

### Simulation API

`POST /api/simulation/analyze`

```json
{
  "design_id": 1,
  "mission_slug": "earthwatch-01",
  "design_data": { "altitude_km": 550, "inclination_deg": 97.59 }
}
```

`design_data` carries only the orbit selected in the planner. The saved design is
loaded from SQLite and mass, power, cost and category coverage are recomputed
from the seeded catalog; engineering budgets are never accepted from the
browser. An unsaved design can be simulated by omitting `design_id` and
supplying `components` (`[{"component_id": 1, "quantity": 1}]`) plus an optional
`design_name`.

The response contains `run` (30-day timeline with battery and communications
state), `raw_score`, `score_breakdown` and `readiness`. Results are deterministic
and computed from the seeded reference data.

### Scientific data integrity

- Reference constants in `data/reference/` require a source URL and original value/unit. Converted to SI with Pint.
- Catalog entries are educational estimates: `data_classification = "estimated"`, a written rationale, and **no** source.
- Database constraints: `estimated` rows cannot cite a source; `published_reference` rows must cite one; derived/estimated scientific rows require a method note.
- Mission budgets are educational scenario limits, not NASA requirements. No NASA specification or vendor datasheet has been fabricated.

### Verification gates

```powershell
cd backend
uv run ruff check .
uv run pytest

cd ..\frontend
npm run typecheck
npm run lint
npm run test
npm run build
```

## Pending

- **B6**: Production readiness — deployment, hosting, and final documentation.

## Notes

- `uv` is installed at `%APPDATA%\Python\Python314\Scripts\uv.exe` on this machine. Restart the terminal if a fresh shell cannot find it.
- The database is persisted at `backend/var/ton618.db`. Delete it to force a clean reseed.
- The project targets Python 3.14 and uses `tsc -b` for type checking.
- No auth, no decorative features. The focus is a complete, playable EarthWatch-01 mission.
