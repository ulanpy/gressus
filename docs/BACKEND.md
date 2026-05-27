# Backend layout

FastAPI entrypoint: `backend/main.py` (`uvicorn backend.main:app`).

Layering follows the NU Space backend pattern: **API → Service → infrastructure**, with shared config and lifespan hooks.

## Repository layout

```
backend/          # FastAPI server, runtime control, pgear telemetry
ros2_ws/src/    # ROS 2 packages (common, calibration, game, insole, realsense, msgs)
ros2_ws/tools/  # dev scripts (realsense_depth_preview; source install/setup.bash first)
frontend/       # Web UI (public/ + src/assets/ for bundled static)
config/         # Machine-local JSON (calibration.json gitignored; see example)
docs/media/     # README / marketing screenshots
```

## Backend directories

| Path | Role |
|------|------|
| `backend/main.py` | App factory, CORS |
| `backend/lifespan.py` | Startup/shutdown, router registration |
| `backend/routers.py` | Router list (no re-export `__init__.` files) |
| `backend/core/configs/config.py` | `pydantic-settings` (env / `.env`) |
| `backend/app_state/` | Setup/cleanup for process manager |
| `backend/common/dependencies.py` | FastAPI `Depends` wiring |
| `backend/modules/health/` | `/api/health` |
| `backend/modules/insole/` | Static sensor geometry API (`/api/geometry`; data in `sensors_m.py` / `sensors_s.py`) |
| `backend/modules/runtime/` | Game/calibration subprocess control |
| `backend/runtime/process_manager.py` | Subprocess manager |
| `backend/modules/pgear/` | Exoskeleton UDP schemas + codec (receiver/service later) |
| `ros2_ws/src/gressus_insole/` | TCP ingest, `/insole/pressure`, WebSocket fanout |
| `ros2_ws/src/gressus_game/` | Tile game library + `tile_game_node` |
| `ros2_ws/src/gressus_calibration/` | AprilTag calibration (`calibrate_apriltag`) |
| `ros2_ws/src/gressus_realsense/` | RealSense publisher + depth helpers |

## Shared with ROS nodes (`gressus_common/` + `gressus_game/`)

| Path | Role |
|------|------|
| `gressus_common/insole_types.py` | `InsoleSnapshot`, `PressureStats` |
| `gressus_common/insole_frame_payload.py` | JSON frame builder for WebSocket clients |
| `gressus_game/insole_ros_feed.py` | ROS topic → snapshot cache for the game |
| `gressus_game/tile_game.py` | Pygame loop; fed by ROS topics via `tile_game_node` |
| `gressus_game/paths.py` | Fixed repo paths (`config/calibration.json`) |
| `gressus_game/calibration.py` | Load `config/calibration.json` |
| `gressus_game/display.py` | Fullscreen projector window helper |
| `gressus_realsense/realsense_depth.py` | RealSense pipeline + tile depth/RGB signals |

## Module files

Each feature module uses:

- `api.py` — routes only
- `service.py` — business logic, no HTTP
- `schemas.py` — Pydantic DTOs

Imports use absolute paths (`from backend.modules.insole.service import InsoleService`). No barrel `__init__.py` re-exports.

## Data flow

```
WaveX (Windows) ──TCP JSONL :9100──► gressus_insole/insole_bridge_node
                                         │
                         ┌───────────────┴───────────────────────┐
                         │                                       │
                  /insole/pressure (ROS)              ws://…:8765/ws/insole
                         │                                       │
                 tile_game_node                         frontend (Therapist tab)
                    RosInsoleFeed                              WebSocket
```

```
Control UI ──POST /api/runtime/start──► RuntimeService ──► ProcessManager ──► ros2 run gressus_game tile_game_node
```

**Mock / demo gait:** synthetic insole frames are generated in the frontend (`useInsoleFrame.ts`) when the operator selects mock mode. Live WebSocket requires `ros2 run gressus_insole insole_bridge_node`.

**Insole threshold:** the Control panel slider sets `--insole-thresh-kpa` at game start. WebSocket clients pass `threshold_kpa=…`; `pressed` stats in each frame use the same threshold.
