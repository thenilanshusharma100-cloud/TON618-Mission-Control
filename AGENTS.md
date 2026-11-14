# AGENTS.md

TON618 — Mission Control. A NASA Space Apps mission-design game: pick a spacecraft, plan an orbit, run the mission, get a scored report. Solo developer, emergency MVP sprint — favor complete working vertical slices over breadth. No auth, no decorative features.

## Commands

Backend (run from `backend/`; relative paths for the DB and catalog depend on it):

```powershell
uv sync
uv run uvicorn app.main:app --reload --port 8000
uv run pytest
uv run pytest tests/test_calculations.py::test_totals_include_quantities_and_power_roles
uv run ruff check .
```

Frontend (run from `frontend/`):

```powershell
npm run dev          # http://localhost:5173, proxies /api to 127.0.0.1:8000
npm run typecheck    # tsc -b
npm run lint         # oxlint (not ESLint)
npm run test         # vitest run
npx vitest run src/lib/missions.test.ts
npm run build
```

Gate order before calling a milestone done: `ruff -> pytest`, then `typecheck -> lint -> test`, then `build`.

## Environment gotchas

- `uv` was installed with pip, not the installer. Binary: `%APPDATA%\Python\Python314\Scripts\uv.exe`. User PATH was updated, but already-open shells may need the full path.
- Python is pinned to 3.14 (`backend/.python-version`).
- Start the backend from `backend/`. `TON618_DATABASE_URL` defaults to `sqlite:///./var/ton618.db`; `TON618_CATALOG_DIR` defaults to `../data`.
- The DB is created and seeded automatically on FastAPI startup (`app/db/init_db.py`). Delete `backend/var/ton618.db` to force a clean reseed.
- Tests use a temp SQLite file configured in `backend/tests/conftest.py`; never point tests at the dev DB.
- No CORS config: the Vite dev proxy handles `/api`. Keep it that way for local dev.
- TypeScript 7 sets `erasableSyntaxOnly`: no enums, namespaces, or constructor parameter properties.
- Tailwind is v4, CSS-first. Theme tokens live in `frontend/src/index.css` under `@theme`; there is no `tailwind.config.js`.
- FastAPI routes use `DbSession = Annotated[Session, Depends(get_db)]` from `app/api/deps.py`; do not use `Depends()` as a default argument (ruff B008).
- Ruff ignores `UP037` because SQLAlchemy/Pydantic forward references must stay quoted.

## Non-negotiable rules

- All internal physical calculations use SI base units via Pint (`app/core/units.py`). Convert only for display.
- NASA/JPL reference data must stay separate from educational assumptions. `data/reference/` constants require a real source URL, original value and original unit; the seeder converts with Pint and stores both SI and original forms.
- Component catalog entries are educational estimates: `data_classification = "estimated"`, a written rationale, and **no** source. Never attach a source to an estimate. Never fabricate a NASA source or specification.
- DB constraints enforce provenance: estimated rows cannot cite a source; published rows must cite one; derived/estimated scientific rows require a method note.
- Simulation output must be computed and deterministic — no hardcoded or fake results.
- No dead controls or placeholder UI. If a feature is cut, remove its entry point.

## Layout

```
data/reference/            cited constants (sources.json, earth_constants.json)
data/catalog/              components.json (15 estimated components)
data/missions/             earthwatch-01.json
backend/app/models         Mission, Component, Spacecraft, SpacecraftComponent, ScientificData, DataSource
backend/app/services       design.py — pure totals/violations
backend/app/api/routes     health, missions, components, design
backend/app/db             base, seed, init_db
backend/tests              pytest (29 tests)
frontend/src               React (api, components, lib, pages)
```

## API surface (B2)

`GET /api/health`, `GET /api/missions`, `GET /api/components[?category=]`,
`GET /api/components/{id}`, `POST /api/design/calculate`,
`POST /api/design/validate`.

Design payloads use `{"mission_slug": "earthwatch-01", "items": [{"component_id": 1, "quantity": 1}]}`.
Totals are SI; costs are integer USD. `validate` adds `valid` and violation codes
(`EMPTY_DESIGN`, `MASS_OVER_BUDGET`, `POWER_MARGIN_LOW`, `COST_OVER_BUDGET`,
`MISSING_REQUIRED_CATEGORY`).

## Current status

B2 complete: catalog, provenance rules, budgets API, tests, dashboard mission card.
B3 next: spacecraft designer UI and persisted designs.
