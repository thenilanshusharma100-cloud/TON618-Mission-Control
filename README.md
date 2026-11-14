# TON618 — Mission Control

A NASA Space Apps mission-design game. Players assemble an Earth-observation
spacecraft, plan its orbit, run the mission, and get a scored report.

**Status: B2 catalog + budgets.** The backend seeds the EarthWatch-01 mission and
an educational component catalog, and calculates mass, power and cost budgets.
The designer UI arrives in B3.

## Stack

- Frontend: React 19 + Vite 8 + TypeScript 7, Tailwind CSS v4, TanStack Query
- Backend: Python 3.14 + FastAPI, SQLAlchemy + SQLite, Pydantic, Pint
- Units: SI internally. Pint validates dimensionality.
- Data: NASA/JPL reference facts are kept separate from labelled educational
  assumptions. No fabricated NASA specifications.

## Layout

```
data/reference/          cited physical constants (source URL + original units)
data/catalog/            component catalog (educational estimates)
data/missions/           mission profiles
backend/app/api/routes   health, missions, components, design
backend/app/models       SQLAlchemy models
backend/app/services     pure budget calculation
backend/app/db           engine setup, seeding, init
backend/tests            pytest suite
frontend/src             React app
```

## Quickstart (Windows, PowerShell)

Backend (run from `backend/` — relative paths for the SQLite file depend on it):

```powershell
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Frontend (second terminal):

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to `http://127.0.0.1:8000`,
so no CORS setup is required. The database is created and seeded on startup at
`backend/var/ton618.db`. Delete that file to force a clean reseed.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | DB probe, version, unit system |
| GET | `/api/missions` | Mission profiles and budgets |
| GET | `/api/components` | Catalog, optional `?category=` filter |
| GET | `/api/components/{id}` | Component detail with provenance |
| POST | `/api/design/calculate` | Mass, power, cost totals and remaining budgets |
| POST | `/api/design/validate` | Calculation plus budget violations |

Design request:

```json
{
  "mission_slug": "earthwatch-01",
  "items": [{ "component_id": 1, "quantity": 1 }]
}
```

## Verification

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

## Data integrity rules

- Reference constants live in `data/reference/` and require a source URL plus
  the original value and unit. The seeder converts to SI with Pint and stores
  both forms.
- Estimated catalog data has no source by construction; it carries an
  engineering rationale instead.
- Database constraints reject `estimated` rows that cite a source and
  `published_reference` rows without one.
- Mission budgets are educational scenario limits, not NASA requirements.

## Notes

- `uv` is installed at `%APPDATA%\Python\Python314\Scripts\uv.exe` on this
  machine. Restart the terminal if a fresh shell cannot find it.
- The database is gitignored.
- The project targets Python 3.14 and uses `tsc -b` for type checking.
