# AGENTS.md

Guidance for AI coding agents and developers working with the Cosmo Constellation Simulator codebase.

## Project Overview

Web service for LEO satellite constellation design, orbital network simulation, and communication availability analysis in Arctic regions (CosmoHackathon 2026, Case 2).
- Simulates 48 satellites (altitude 550 km, inclination 87°, 3 orbital planes, 3 launch stages).
- Dynamic routing: Client ground sites (`C65`, `C70`, `C72`) -> Satellites (ISL mesh) -> Gateway (`G_MUR`).
- Failure diagnosis: `no_client_satellite`, `gateway_offline`, `no_gateway_satellite`, `isl_disconnected`.
- Formats: input `cosmo-A-1.0`, export `cosmo-A-result-1.0`.

---

## Commands

### Backend (Python + `uv` only)
Always use `uv`. Never run bare `pip` or system `python`.

- `cd backend && uv sync` - Sync virtualenv and install dependencies
- `cd backend && uv run uvicorn app.main:app --reload --port 8000` - Run development API server
- `cd backend && uv run pytest --cov=app --cov-report=term` - Run test suite with coverage
- `cd backend && uv run ruff check` - Lint codebase
- `cd backend && uv run ruff format --check` - Verify code formatting

### Frontend (React + Vite + Bun / npm)
Can use `bun` or `npm`.

- `cd frontend && npm run dev` (or `bun run dev`) - Start Vite dev server on port 5173
- `cd frontend && npm test` (or `bun test`) - Run Vitest unit tests for client-side math
- `cd frontend && npm run lint` - Run Oxlint
- `cd frontend && npm run build` - TypeScript check + production Vite build to `frontend/dist/`
- `cd frontend && npm run preview` - Serve production build locally

---

## Architecture & Design Patterns

### 1. Dual Execution Engine (High Availability)
- **Backend API**: FastAPI + vectorized NumPy engine (`backend/app/core/`). Exposes endpoints `/api/simulate`, `/api/snapshot`, `/api/validate`, `/api/export`, `/api/compare`.
- **Frontend Fallback**: `frontend/src/lib/orbit.ts` replicates identical celestial physics, coordinates, ISL geometry, Dijkstra shortest-path routing, and outage diagnostics in TypeScript. Enables fully functional standalone execution on static hostings (GitHub Pages) without backend dependencies.

### 2. Visualization & State
- Canvas-based visualizer: 2D equirectangular projection and 3D orthographic globe (`NetworkMap.tsx`).
- 24h timeline player with scrub slider and speed control (1x/5x/20x/60x) (`TimelinePlayer.tsx`).
- Interactive availability Gantt chart per client with outage tooltips.
- A/B comparison view with parameter delta and SLA compliance breakdown (`ComparisonView.tsx`).

### 3. CI/CD & Production
- Workflow: `.github/workflows/deploy.yml`.
- Parallel jobs: `backend-checks` (ruff, pytest-cov) and `frontend-checks` (oxlint, vitest, build).
- Deployment: Deploys `frontend/dist/` to GitHub Pages and to VPS via `rsync` over SSH (`state3407.space/cosmo/`).

---

## File Organization

```
case_2_satellite_constellation/
├── backend/
│   ├── app/
│   │   ├── api/routes.py          # FastAPI endpoints
│   │   ├── core/
│   │   │   ├── geometry.py        # ECEF/inertial orbit calculations
│   │   │   ├── routing.py         # Dijkstra/BFS graph solver & diagnostics
│   │   │   ├── simulator.py       # 24h timeline & SLA calculator
│   │   │   ├── validator.py       # Strict cosmo-A-1.0 validation
│   │   │   └── export.py          # cosmo-A-result-1.0 exporter
│   │   └── main.py                # FastAPI entrypoint & CORS
│   └── tests/                     # 30 pytest unit and integration tests
├── frontend/
│   ├── src/
│   │   ├── components/            # NetworkMap, TimelinePlayer, MetricsPanel, ConfigEditor, ComparisonView
│   │   ├── lib/orbit.ts           # Client-side orbital & routing engine
│   │   ├── lib/orbit.test.ts      # Vitest test suite
│   │   └── types/scenario.ts      # TypeScript interfaces
│   └── vite.config.ts             # Relative base './' and /api proxy
├── docs_md/                       # Specifications, data schema, and grading criteria
├── Данные/                        # 4 benchmark scenario datasets (01..04)
├── Расчетный модуль/             # Reference physics module (geometry.py)
└── .github/workflows/deploy.yml   # Multi-job CI/CD pipeline
```

---

## Commit Guidelines

Follow single-line Conventional Commits, max 72 characters:
```
<type>(<scope>): <description>
```
Types: `feat`, `fix`, `refactor`, `style`, `chore`, `docs`, `ci`, `test`.
No commit body or footer.
