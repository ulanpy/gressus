# Backend

FastAPI entrypoint: `backend/main.py` (`uvicorn backend.main:app`).

Layering: **API → Service → infrastructure** (repository or HTTP client). Coding rules: [../backend/README.md](../backend/README.md).

System context (frontend, ROS, session lifecycle): [architecture.md](architecture.md).

## Repository layout

```
backend/          # FastAPI server
frontend/         # Web UI
ros2_ws/src/      # ROS 2 packages
config/           # Machine-local JSON (calibration.json gitignored)
docs/             # Project documentation
```

## Modules

| Path | Role |
|------|------|
| `backend/modules/patients/` | Patient CRUD |
| `backend/modules/sessions/` | Clinical sessions per patient |
| `backend/modules/assessments/` | Assessment forms |
| `backend/modules/runtime/` | `SessionManagerClient` + `RuntimeService` → session manager `:9090` |

ROS packages referenced by runtime: `gressus_session`, `gressus_pgear`, `gressus_bringup` — details in [ROS.md](ROS.md).

## Runtime API

Proxied to session manager (`SESSION_MANAGER_URL`, default `http://127.0.0.1:9090`). Response shapes: `backend/modules/runtime/schemas.py`.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/runtime/status` | Session manager snapshot |
| `POST /api/runtime/stack/start` | Launch ROS stack (`job`: `feedback`, `game`, `calibrate_apriltag`) |
| `POST /api/runtime/stack/stop` | Stop active launch |
| `POST /api/runtime/pgear/load-profile` | Load P.GEAR exo profile JSON |
| `POST /api/runtime/pgear/arm` | Arm exoskeleton |
| `POST /api/runtime/pgear/disarm` | Disarm |
| `POST /api/runtime/pgear/run` | Start gait |
| `POST /api/runtime/pgear/stop-gait` | Stop gait |
| `POST /api/runtime/pgear/estop` | Emergency stop |
| `POST /api/runtime/start` | Legacy alias → stack start (game modes) |
| `POST /api/runtime/stop` | Legacy alias → stack stop |

`sessionId` and `patientId` on stack start are forwarded to session manager and exported as ROS env vars — see [architecture.md](architecture.md).

## Docker

Backend runs in the `backend` compose service on port `:8000`. Startup and compose overview: [../README.md](../README.md).

Dependencies: `backend/pyproject.toml` (FastAPI, httpx, SQLAlchemy, asyncpg, Alembic).

## Data flow (backend-centric)

```
Frontend ──REST──► Backend
                      │
                      ├── PostgreSQL (patients, sessions, assessments)
                      │
                      └── RuntimeService ──HTTP──► session_manager (:9090)
```

Insole WebSocket and ROS topics bypass the backend — see [architecture.md](architecture.md).
