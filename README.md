# TON618 — Mission Control

A NASA Space Apps mission-design game. Players assemble an Earth-observation
spacecraft, plan its orbit, run the mission, and get a scored report.

**Status: B1 foundation.** Backend health link, mission-control shell, and test
gates are in place. Mission catalog and gameplay arrive in B2+.

## Stack

- Frontend: React 19 + Vite 8 + TypeScript 7, Tailwind CSS v4, TanStack Query
- Backend: Python 3.14 + FastAPI, SQLAlchemy + SQLite, Pydantic, Pint
- Units: SI internally. Pint validates dimensionality.
- Data: NASA/JPL reference facts are kept separate from labelled educational
  assumptions. No fabricated NASA specifications.

## Layout

```
backend/app        FastAPI app (core, api, schemas; domain/data land in B2)
backend/tests      pytest suite
frontend/src       React app (api, components, lib, pages)
frontend/vitest.config.ts
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
so no CORS setup is required. Health check: http://127.0.0.1:8000/api/health

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

## Notes

- `uv` is installed at `%APPDATA%\Python\Python314\Scripts\uv.exe` on this
  machine. Restart the terminal if a fresh shell cannot find it.
- The database is created lazily at `backend/var/ton618.db` and is gitignored.
- The project targets Python 3.14 and uses `tsc -b` for type checking.
