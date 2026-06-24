# Architecture

Gressus is a three-tier system on one host (or a small local network): web client, API server, and ROS runtime with hardware nodes.

## Control path

```
Frontend (operator UI)
    → Backend (FastAPI: patients, sessions, runtime API)
        → Session manager (ROS container, HTTP :9090)
            → pgear_device_node (exoskeleton control + telemetry)
            → GRESSUS_SESSION_DATA_DIR (session recordings)
```

| Layer | Responsibility |
|-------|----------------|
| **Frontend** | Patient and session workflow; therapist views; runtime and exoskeleton controls. |
| **Backend** | PostgreSQL entities (patients, sessions, assessments); REST API; proxies stack and P.GEAR commands to the session manager. |
| **Session manager** | Spawns `ros2 launch` jobs; calls `pgear_device_node` services via rclpy; injects clinical session ids into child process environment. |
| **P.GEAR node** | Primary runtime node today: ESP32 link, profile load, arm/disarm/run/stop, `/exoskeleton/telemetry`. |

Clinical ids from the backend become environment variables for downstream nodes:

- `GRESSUS_SESSION_ID`
- `GRESSUS_PATIENT_ID`
- `GRESSUS_SESSION_DATA_DIR` — `{GRESSUS_SESSION_DATA_ROOT}/{patientId}/{sessionId}`

## Frontend

Web app in `frontend/`. Operator-facing areas:

- **Patients & sessions** — create and manage clinical records (via backend REST).
- **Therapist** — live insole pressure heatmaps when the insole stack is running.
- **Control** — start/stop feedback stacks, P.GEAR commands, calibration and legacy game modes.
- **Patient** — simplified session view.

Live insole data: WebSocket `ws://127.0.0.1:8765/ws/insole` from `insole_bridge_node`. Exoskeleton telemetry: `ws://127.0.0.1:8766/ws/exoskeleton` from `pgear_device_node`.

## Backend

FastAPI app in `backend/`. Module layout and runtime endpoints: [BACKEND.md](BACKEND.md).

Runtime control never talks to ROS directly — only HTTP to session manager on `:9090`.

## ROS runtime

ROS 2 workspace in `ros2_ws/src/`. Entry process: `session_manager` (`ros2 run gressus_session session_manager`).

Launch composition, individual nodes, and CLI commands: [ROS.md](ROS.md).

### Nodes and integration status

| Component | Package | Role | Session integration |
|-----------|---------|------|---------------------|
| P.GEAR exoskeleton | `gressus_pgear` | Device control, telemetry | **Active** — core path |
| Session manager | `gressus_session` | Launch orchestration, P.GEAR proxy | **Active** |
| Insole bridge | `gressus_insole` | TCP ingest, ROS topic, WebSocket | In `feedback.launch.py`; wiring to session recording in progress |
| RealSense camera | `gressus_realsense` | Depth/RGB for feedback and game | In `feedback.launch.py` |
| AprilTag calibration | `gressus_calibration` | Camera–projector homography | Standalone; used by tile game |
| Tile game | `gressus_game` | Projector visual feedback | Legacy launch modes; optional |
| Video recording | `gressus_video` | Session video capture | Planned |

Insole, camera, video, calibration, and the tile game share the same clinical session model and will be tied into recording and readiness checks incrementally. Exoskeleton control does not depend on them.

## Network (Docker Compose)

All application containers use `network_mode: host` so localhost ports are shared:

| Port | Consumer |
|------|----------|
| `:5173` | Vite / frontend |
| `:8000` | FastAPI |
| `:5435` | PostgreSQL (host-mapped) |
| `:9090` | Session manager |
| `:8765` | Insole WebSocket |
| `:8766` | Exoskeleton WebSocket |
| `:9100` | Insole TCP ingest |

## Related docs

- [BACKEND.md](BACKEND.md) — API modules, runtime routes, repository layout
- [ROS.md](ROS.md) — launch files and manual ROS commands
- [system-spec.md](system-spec.md) — physical hardware setup
