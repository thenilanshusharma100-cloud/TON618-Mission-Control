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
- No CORS config is needed for proxy-based local development; the backend now
  reads allowed origins from `TON618_CORS_ORIGINS` for direct cross-origin use.
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
backend/app/services       design.py — pure totals/violations; orbit.py — J2/SSO;
                           simulation.py — timeline, battery, scoring
backend/app/api/routes     health, missions, components, design, designs, orbit, simulation
backend/app/api            design_support.py — shared mission/item resolution
backend/app/db             base, seed, init_db
backend/tests              pytest (59 tests)
frontend/src               React (api, components, lib, pages)
```

## API surface

`GET /api/health`, `GET /api/missions`, `GET /api/components[?category=]`,
`GET /api/components/{id}`, `POST /api/design/calculate`,
`POST /api/design/validate`, `GET /api/designs[?mission_slug=]`,
`POST /api/designs`, `GET /api/designs/{id}`, `PUT /api/designs/{id}`,
`POST /api/orbit/analyze`, `POST /api/simulation/analyze`.

Design payloads use `{"mission_slug": "earthwatch-01", "items": [{"component_id": 1, "quantity": 1}]}`.
Saved-design create adds `name`; update omits `mission_slug`. Totals are SI; costs
are integer USD. `validate` adds `valid` and violation codes
(`EMPTY_DESIGN`, `MASS_OVER_BUDGET`, `POWER_MARGIN_LOW`, `COST_OVER_BUDGET`,
`MISSING_REQUIRED_CATEGORY`). Saved designs are `Spacecraft` rows and store lines
as `SpacecraftComponent`; duplicate component ids are merged server-side.

Simulation payloads use `{"design_id": 1, "mission_slug": "earthwatch-01",
"design_data": {"altitude_km": 550, "inclination_deg": 97.59}}`. Mass, power,
cost and category coverage are recomputed from the saved design and seeded
catalog; the request never supplies engineering budgets. The response carries
`run` (30-day timeline + battery/comm state), `raw_score`, `score_breakdown`
and `readiness`.

## Current status

B3 complete: `/designer` console (7 categories, interactive 2D schematic,
manifest, live backend validation) and persisted design CRUD. Demo DB holds
"EarthWatch-01 Baseline" (valid) and "High-Resolution Concept" (invalid).
B4 complete: orbit planner (J2 nodal precession, sun-synchronous solver,
  3D globe, live API). Demo DB holds 550 km educational assumption and
  verified orbital metrics.
B5 complete: mission simulation and scoring against the saved design and
  selected orbit — 30-day timeline, battery integration, ground-station
  passes, readiness and a 100-point score, with START/PAUSE/RESUME/RESET
  playback in `/simulation`.
