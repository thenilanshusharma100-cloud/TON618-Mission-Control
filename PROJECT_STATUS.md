# PROJECT STATUS — TON618 Mission Control

**Deadline: 15 November 2026, 12:00 noon IST.**

A NASA Space Apps mission-design game. The player will assemble a spacecraft, plan
its orbit, run the mission and receive a scored report. This file records what
actually exists; planned items are marked as not started.

## Architecture and stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, TypeScript 7, Tailwind CSS v4, TanStack Query |
| Backend | Python 3.14, FastAPI, Pydantic, SQLAlchemy 2 |
| Database | SQLite (`backend/var/ton618.db`), created and seeded on startup |
| Units | Pint; all internal physical values are SI, converted only for display |
| Tests | pytest (backend), Vitest + Testing Library (frontend) |
| Linting | Ruff (backend), oxlint (frontend), `tsc -b` type checking |

All physics, budgets and scoring logic live in the Python backend. The frontend
is display-only and does not reimplement calculations.

```
data/reference/          cited constants: sources.json, earth_constants.json
data/catalog/            components.json — 15 estimated components
data/missions/           earthwatch-01.json
backend/app/models       SQLAlchemy models
backend/app/services     design.py — pure totals and violation logic
backend/app/api/routes   health, missions, components, design
backend/app/db           base, seed, init_db
backend/tests            pytest suite
frontend/src             React app (api, components, lib, pages)
```

## Completed milestones

### B1 — Foundation (commit `b13dd1f`)

- FastAPI app with `/api/health` (database probe, version, unit system).
- React mission-control shell, Vite dev proxy from `/api` to the backend.
- Initial tests and lint/typecheck tooling.

### B2 — Scientific catalog and budget engine (commit `309d73d`)

- Six SQLAlchemy models covering missions, catalog, designs and scientific data.
- Seed catalog: EarthWatch-01 plus 15 components across all seven categories.
- Seven scientific constants: six published NASA NSSDCA references and one
  derived value. Each stores its original value/unit and the Pint-converted SI
  value.
- Database-level provenance constraints (see below).
- Pure calculation service: totals, remaining budgets, category breakdown and
  violation codes.
- Five new API endpoints, all verified live over HTTP.
- 29 backend tests and a dashboard mission card driven by live API data.

## Database models

| Model | Purpose |
|---|---|
| `Mission` | Mission slug, briefing, mass/cost/power-margin budgets, required categories |
| `Component` | Catalog entry: category, mass kg, power W and role, cost USD, classification, rationale, optional source |
| `Spacecraft` | Persisted spacecraft belonging to a mission (model exists; no API yet) |
| `SpacecraftComponent` | Quantity of a component on a spacecraft; unique per spacecraft/component |
| `ScientificData` | Physical constant: SI value, original value/unit, classification, method, source |
| `DataSource` | Cited source: title, publisher, URL, retrieval date, kind (NASA/JPL/vendor/standard/other) |

Component categories: `structure`, `power`, `communication`, `onboard_computer`,
`payload`, `propulsion`, `thermal_control`.

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Database probe, version, unit system |
| GET | `/api/missions` | Mission profiles and budgets |
| GET | `/api/components` | Component catalog, optional `?category=` filter |
| GET | `/api/components/{id}` | Component detail with provenance (404 if missing) |
| POST | `/api/design/calculate` | Totals, remaining budgets, category breakdown |
| POST | `/api/design/validate` | Calculation plus `valid` flag and violations |

Design request body:

```json
{
  "mission_slug": "earthwatch-01",
  "items": [{ "component_id": 1, "quantity": 1 }]
}
```

Totals are SI; costs are integer USD. Violation codes: `EMPTY_DESIGN`,
`MASS_OVER_BUDGET`, `POWER_MARGIN_LOW`, `COST_OVER_BUDGET`,
`MISSING_REQUIRED_CATEGORY`.

Verified baseline design: **5.7 kg, 28.0 W generation, 14.5 W consumption,
13.5 W margin, $332,000, valid** against an 8 kg / $500,000 / 5 W-margin mission.

## Scientific data classification rules

| Classification | Rules |
|---|---|
| `published_reference` | Must cite a `DataSource` with a real URL; stores the original value and unit alongside the SI value. Used only for the six NASA NSSDCA Earth Fact Sheet constants. |
| `derived` | Must include a method note and does not claim to be a published value. Used for Earth sidereal angular velocity, computed from the published rotation period. |
| `estimated` | Educational assumption. Must include a written rationale and **must not** cite a source. All 15 catalog components are estimated. |

Enforced by database check constraints, not just convention:

- `published_reference` without a source is rejected.
- `estimated` with a source is rejected.
- `derived` or `estimated` without a method note is rejected (scientific data).
- `estimated` components require a rationale.

Mission budgets are explicitly labelled educational scenario limits, not NASA
requirements. No NASA specification or vendor datasheet has been fabricated.

## Commands

Backend — run from `backend/` because the database and catalog paths are
relative to the working directory:

```powershell
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

On this machine `uv` is at `%APPDATA%\Python\Python314\Scripts\uv.exe`.

Frontend — second terminal, run from `frontend/`:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev proxy forwards `/api` to
`http://127.0.0.1:8000`; no CORS configuration is needed. Delete
`backend/var/ton618.db` to force a clean reseed on the next backend start.

Quality gates:

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

## Test results (last verified at commit `309d73d`)

| Gate | Result |
|---|---|
| `ruff check .` | Passed |
| `pytest` | 29 passed (models, constraints, seeding, calculations, API) |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run test` | 8 passed in 2 files |
| `npm run build` | Passed (production bundle generated) |

One harmless warning remains: FastAPI's test client reports that `httpx` is
deprecated in favour of `httpx2`.

## Remaining milestones

- **B3 — Spacecraft designer (next):** component selection UI, live totals and
  violations, persisted designs. The `Spacecraft` models exist, but there is no
  persistence API or designer screen yet.
- **B4 — Orbit planner:** orbital parameters, coverage/ground-track reasoning,
  validated against the cited Earth constants.
- **B5 — Simulation and scoring:** deterministic mission run and scored report.
- **B6 — Results and deployment:** results screen, production build and hosting.

The current UI is the system-status dashboard plus the EarthWatch-01 mission
card. Component browsing, design assembly and orbit planning are not yet
available in the browser.

## Current status summary

B1 and B2 are complete, committed and gate-verified. B2 is the latest commit
(`309d73d`) and the working tree is clean. B3 has not started.
