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
backend/app/services     design.py — totals/violations; orbit.py — J2/SSO;
                         simulation.py — timeline, battery, scoring
backend/app/api/routes   health, missions, components, design, designs, orbit, simulation
backend/app/api           design_support.py — shared mission/item resolution
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

### B4 — Orbit planner (commit `d7af8db`)

- **Orbit planner at `/orbit`**: altitude (160–2000 km), inclination (0–180°),
  J2 nodal precession, sun-synchronous solver, 3D WebGL globe, orbital metrics
  panel, reference-constant documentation, and model assumptions/limitations.
- **Physics engine** (`backend/app/services/orbit.py`): circular LEO formulas,
  first-order J2 precession `Ω̇ = −(3/2) J₂ (R/r)² n cos i`, sun-synchronous
  inclination solver from `acos[−(2/3)Ω̇_target / (J₂(R/r)² n)]`, all SI
  internally, Pint-backed unit conversion in the API layer.
- **API** `POST /api/orbit/analyze`: returns orbital radius, velocity, period,
  specific orbital energy, angular momentum per unit mass, mean motion, orbits
  per day, nodal precession rate, and SSO status with required inclination and
  delta.
- **Scientific integrity**: gravitational parameter `μ = 3.986004418×10¹⁴ m³/s²`,
  equatorial radius `R_E = 6378.1 km`, J₂ `0.00108263` — all from the seeded
  NASA NSSDCA Earth Fact Sheet data. 550 km explicitly labelled as an educational
  assumption, not a NASA mission specification.
- **Visualization**: Three.js 3D scene with Earth sphere, wiregrid, equator,
  starfield, satellite marker on J2-precessing orbit, sun-synchronous green
  badge, drag-to-rotate and scroll-to-zoom.
- **Assumptions document**: 5 named assumptions (circular Keplerian, J2 only,
  radius = R_E + h, SSO convention = 1 rev/365.2422-day tropical year,
  first-order secular J2).
- **Limitations document**: 4 named limitations (no drag, no solar/lunar
  perturbations, no higher zonal harmonics, steady-state not propagated
  ephemeris, educational model only).
- **Testing**: 13 backend pytest (orbital elements match closed-form, J2
  precession correctness, SSO inclination varies with altitude, model rejects
  invalid inputs) and 42 frontend Vitest (domain clamps, formatting, planner
  integration, engine failure surface).

### B3 — Interactive spacecraft designer

- Designer screen at `/designer`: category sidebar, interactive 2D spacecraft
  schematic (approved fallback; no Three.js dependency), selected-component
  manifest and live engineering metrics.
- Browse all seven categories, inspect specifications and estimate rationale,
  add, remove and change quantities (1–100, enforced on both sides).
- Live backend validation on every edit: mass, generation, consumption, net
  power margin, remaining mass/cost, required-subsystem coverage and violation
  messages. No client-side physics.
- Persisted designs on the existing `Spacecraft` / `SpacecraftComponent` models:
  create (`POST`), list, load, update (`PUT`) through FastAPI and SQLite.
  Duplicate component ids are merged; saved names are trimmed and validated.
- The most recently updated design loads automatically; `+ NEW DRAFT` starts a
  fresh design. Unsaved changes prompt before switching records.
- Demo records: "EarthWatch-01 Baseline" (valid, 5.70 kg / $332,000 / +13.5 W)
  and "High-Resolution Concept" (invalid: mass, cost and power faults).
- 35 backend tests and 29 frontend tests, including designer integration tests
  for add/quantity/remove, validation and save/load wiring.

### B5 — Mission simulation and scoring (commit `e2053ce`)

- **Simulation console at `/simulation`**: loads the latest saved design and the
  orbit selected in the planner, runs the mission against the seeded budgets,
  and plays back a 30-day timeline with START/PAUSE/RESUME/RESET. Shows the
  100-point score, per-category breakdown, readiness, warnings and violations.
- **Engine** (`backend/app/services/simulation.py`): deterministic 30-day run
  sampled once per completed orbit; 60-second battery integration with
  generation, consumption, eclipse and ground-station passes; communications
  contact fraction; payload state; score derived from orbit achievement, power,
  mass, communications, payload and budget; readiness derived from the run.
- **API** `POST /api/simulation/analyze`: accepts `design_id`, `mission_slug`
  and orbit-only `design_data` (`altitude_km`, `inclination_deg`); reloads the
  saved design and catalog and recomputes mass, power, cost and category
  coverage server-side. Unknown designs return 404 `DESIGN_NOT_FOUND`; empty
  designs and mission mismatches return 422; missing orbit reference data
  returns 503.
- **UI**: typed response contract, real error surfacing, playback controls, and
  removal of the unused fake client-side simulation stub.
- **Testing**: 12 simulation backend tests (including the exact request that
  previously raised a 503) and 6 simulation UI tests. The complete workflow was
  verified in the browser against both the valid and invalid demo designs.

## Database models

| Model | Purpose |
|---|---|
| `Mission` | Mission slug, briefing, mass/cost/power-margin budgets, required categories |
| `Component` | Catalog entry: category, mass kg, power W and role, cost USD, classification, rationale, optional source |
| `Spacecraft` | Persisted spacecraft design belonging to a mission (name, timestamps, component lines) |
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
| GET | `/api/designs[?mission_slug=]` | Saved designs, most recently updated first |
| POST | `/api/designs` | Create a saved design (201) |
| GET | `/api/designs/{id}` | Load a saved design with validation |
| PUT | `/api/designs/{id}` | Rename and replace a saved design's items |
| POST | `/api/orbit/analyze` | J2 precession, SSO solver and orbital metrics |
| POST | `/api/simulation/analyze` | 30-day mission run, score and readiness |

Design request body:

```json
{
  "mission_slug": "earthwatch-01",
  "items": [{ "component_id": 1, "quantity": 1 }]
}
```

Saved-design create body adds `name`; update omits `mission_slug` (the mission is
fixed when a design is created). Every saved-design response includes the same
calculation and validation payload as `POST /api/design/validate`, plus `id`,
`name`, `items`, `mission_id` and UTC timestamps. Missing missions and designs
return 404 with `MISSION_NOT_FOUND` / `DESIGN_NOT_FOUND`; unknown component ids
return 422 `UNKNOWN_COMPONENT_IDS`.

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

## Test results (B5, verified before commit)

| Gate | Result |
|---|---|
| `ruff check .` | Passed |
| `pytest` | **59 passed** |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed (0 warnings) |
| `npm run test` | **48 passed** |
| `npm run build` | Passed, production bundle generated |

Live HTTP checks: `POST /api/simulation/analyze` returned 200 both directly
against `127.0.0.1:8000` and through the Vite proxy at `localhost:5173`. The
valid demo design scored 95 with status `success`; the invalid design scored 55
with status `failure` and the expected mass, power and cost violations.

## Remaining milestones

- **B6 — Deployment (next):** production build, hosting and final deployment
  documentation.

## Current status summary

B1–B5 are complete and gate-verified. The browser exposes the dashboard, the
`/designer` console, the `/orbit` planner and the `/simulation` console. The
simulation workflow has been verified end-to-end in the browser; deployment has
not started.
