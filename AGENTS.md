# AGENTS.md

TON618 — Mission Control. A NASA Space Apps mission-design game: pick a spacecraft, plan an orbit, run the mission, get a scored report. Solo developer, emergency MVP sprint — favor complete working vertical slices over breadth. No auth, no decorative features.

## Commands

Backend (run from `backend/`; relative paths for the DB and catalog depend on it):

```powershell
uv sync
uv run uvicorn app.main:app --reload --port 8000
uv run pytest
uv run pytest tests/test_units.py::test_kilometres_convert_to_metres
uv run ruff check .
```

Frontend (run from `frontend/`):

```powershell
npm run dev          # http://localhost:5173, proxies /api to 127.0.0.1:8000
npm run typecheck    # tsc -b
npm run lint         # oxlint (not ESLint)
npm run test         # vitest run
npx vitest run src/lib/health.test.ts
npm run build
```

Gate order before calling a milestone done: `ruff -> pytest`, then `typecheck -> lint -> test`, then `build`.

## Environment gotchas

- `uv` was installed with pip, not the installer. Binary: `%APPDATA%\Python\Python314\Scripts\uv.exe`. User PATH was updated, but already-open shells may need the full path.
- Python is pinned to 3.14 (`backend/.python-version`).
- Start the backend from `backend/`. `TON618_DATABASE_URL` defaults to `sqlite:///./var/ton618.db`; `TON618_CATALOG_DIR` defaults to `../data`.
- No CORS config: the Vite dev proxy handles `/api`. Keep it that way for local dev.
- TypeScript 7 sets `erasableSyntaxOnly`: no enums, namespaces, or constructor parameter properties.
- Tailwind is v4, CSS-first. Theme tokens live in `frontend/src/index.css` under `@theme`; there is no `tailwind.config.js`.
- FastAPI is served from `app.main:app`; routes use the `/api` prefix.

## Non-negotiable rules

- All internal physical calculations use SI base units via Pint (`app/core/units.py`). Convert only for display.
- NASA/JPL reference data must stay separate from educational assumptions. Every published value needs a source URL and retrieval date; never fabricate a NASA specification. Label estimates in the UI.
- Simulation output must be computed and deterministic — no hardcoded or fake results.
- No dead controls or placeholder UI. If a feature is cut, remove its entry point.

## Layout

```
backend/app        FastAPI (core, api/routes, schemas; domain + data land in B2)
backend/tests      pytest
frontend/src       React (api, components, lib, pages)
frontend/src/index.css   Tailwind theme tokens
README.md          quickstart
```

## Current status

B1 foundation complete. B2 next: catalog (reference vs assumption), mission/component models, budget validation API.
