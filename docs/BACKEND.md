# Backend layout

FastAPI entrypoint: `backend/main.py` (`uvicorn backend.main:app`).

Layering follows the NU Space backend pattern: **API → Service → infrastructure**, with shared config and lifespan hooks.

## Repository layout

```
backend/          # FastAPI server, insole ingest, runtime control, pgear telemetry
station/          # Station runtime: game library, runners, debug tools
  lib/            # Pygame loop, hit logic, RealSense, calibration, display
  assets/         # Game audio, UI voice phrases (Pygame runtime)
  runners/        # tile_game, calibrate_apriltag (spawned by backend or CLI)
  tools/          # RealSense debug utilities
shared/           # Cross-layer contracts (DTOs — not runtime data)
frontend/         # Web UI (public/ + src/assets/ for bundled static)
config/           # Machine-local JSON (calibration.json gitignored; see example)
docs/media/       # README / marketing screenshots
```

## Backend directories

| Path | Role |
|------|------|
| `backend/main.py` | App factory, CORS |
| `backend/lifespan.py` | Startup/shutdown, router registration |
| `backend/routers.py` | Router list (no re-export `__init__` files) |
| `backend/core/configs/config.py` | `pydantic-settings` (env / `.env`) |
| `backend/app_state/` | Setup/cleanup for TCP receiver and process manager |
| `backend/common/dependencies.py` | FastAPI `Depends` wiring |
| `backend/modules/health/` | `/api/health` |
| `backend/modules/insole/` | Live frames, geometry, WebSocket fanout |
| `backend/modules/runtime/` | Game/calibration subprocess control |
| `backend/modules/insole/receiver.py` | TCP JSONL receiver (WaveX bridge) |
| `backend/modules/insole/sensors_m.py`, `sensors_s.py` | Static sensor layout (mm) |
| `backend/runtime/process_manager.py` | Subprocess manager |
| `backend/modules/pgear/` | Exoskeleton UDP schemas + codec (receiver/service later) |

## Shared with the game (`shared/` + `station/lib/`)

| Path | Role |
|------|------|
| `shared/insole_types.py` | `InsoleSnapshot`, `PressureStats` — used by game + backend |
| `station/lib/insole_ws_client.py` | `/ws/insole` consumer for `tile_game` |
| `station/lib/game/` | Pygame loop, hit logic, RealSense, render |
| `station/lib/calibration.py` | AprilTag / projector calibration |
| `station/lib/display.py` | Fullscreen projector window helper |

## Module files

Each feature module uses:

- `api.py` — routes only
- `service.py` — business logic, no HTTP
- `schemas.py` — Pydantic DTOs

Imports use absolute paths (`from backend.modules.insole.service import InsoleService`). No barrel `__init__.py` re-exports.

## Data flow

```
WaveX (Windows) ──TCP JSONL :9100──► InsoleTcpReceiver
                                         │
                                    InsoleService
                                         │
                         /api/frame   /ws/insole ──► frontend (live)
                                         │
                                         └──► tile_game via station/lib/insole_ws_client.py
```

```
Control UI ──POST /api/runtime/start──► RuntimeService ──► ProcessManager ──► station/runners/tile_game.py
```

**Mock / demo gait:** synthetic insole frames are generated in the frontend (`useInsoleFrame.ts`) when the operator selects mock mode. The backend serves **live TCP ingest only**; `/api/frame` and `/ws/insole` have no `source=mock` parameter.

**Insole threshold:** the Control panel slider sets `--insole-thresh-kpa` at game start. The running game subscribes to `/ws/insole?threshold_kpa=…` with that value; `pressed` stats in each frame use the same threshold.
