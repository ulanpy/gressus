# Gressus — Gait Feedback System

<table>
<tr>
<td width="58%" valign="top">

**Gressus** (from the Latin for *"step"* or *"progress"*) is the visual feedback module of **A-GEAR**, a gait exoskeleton-assisted rehabilitation system for children with cerebral palsy. A projector guides steps on the treadmill; a depth camera and Insolex insoles confirm each footfall in real time.

The prototype uses RealSense depth, AprilTag camera–projector calibration, and optional insole pressure (Insolex/WaveX). Demonstrated at **KIHE-2026 — Kazakhstan International Healthcare Exhibition**, Almaty, 20–22 May 2026.

</td>
<td width="42%" valign="top" align="right">

<img src="docs/media/demo.gif" alt="ExoStep treadmill demo" width="240" />

</td>
</tr>
</table>

## 1. About the project

The child walks on the treadmill and steps on falling tiles (left/right lane). A hit counts only when three signals agree inside the tile zone: **depth** lift above the floor, **occlusion** of projected light by the foot, and **pressure** on the matching Insolex insole (`D AND R AND P`). The goal is rhythmic alternating load and clear feedback without a complex UI.

**Workflow:** depth (aligned-to-color), calibration in `config/calibration.json`, game loop in `ros2_ws/src/gressus_game/` started via `ros2 run gressus_game tile_game_node`. The therapist normally starts sessions from the web GUI.

<p align="center">
  <img src="docs/media/insole-viz-screenshot.png" alt="Therapist view — Insolex pressure visualizer" width="640" />
</p>

## 2. Web GUI

The web app (`frontend/`) is the primary operator interface:

- **Therapist** — live insole pressure heatmaps (left/right foot).
- **Control** — start/stop the tile game and AprilTag calibration, speed and threshold sliders, demo and no-insole modes.
- **Patient** — simplified view for the session.

The FastAPI backend (`backend/`) serves geometry and runtime control. Live insole pressure is streamed by `insole_bridge_node` over WebSocket (`ws://127.0.0.1:8765/ws/insole`) and ROS topic `/insole/pressure`. TCP ingest from Insolex/WaveX runs in the same node on `0.0.0.0:9100`. Demo gait without hardware uses client-side mock pressure in the frontend; game code lives in the ROS package `gressus_game`.

<p align="center">
  <img src="docs/media/web-control-panel-screenshot.png" alt="Web control panel — game and calibration" width="640" />
</p>

### Setup and launch

**Backend** — Python dependencies:

```bash
poetry install
```

**Frontend** — requires [Deno](https://docs.deno.com/runtime/getting_started/installation/) (npm deps are resolved from `frontend/deno.lock` on first run):

```bash
curl -fsSL https://deno.land/install.sh | sh   # Linux/macOS; see Deno docs for other platforms
```

Start the backend:

```bash
poetry run uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

In a separate terminal, start the frontend:

```bash
cd frontend
deno task dev
```

Open `http://localhost:5173`. Use the **Control** tab to start the game; live insole data appears on **Therapist** once a session is running.

## 3. ROS 2 runtime

Build the workspace once inside the ROS container (see `docker-compose.yml`), then run three nodes in separate terminals:

```bash
docker compose exec ros2 bash
source /opt/ros/jazzy/setup.bash && source /gressus/ros2_ws/install/setup.bash

# 1 — insole TCP + WebSocket + /insole/pressure
ros2 run gressus_insole insole_bridge_node

# 2 — RealSense topics
ros2 run gressus_realsense realsense_node

# 3 — tile game (subscribes to insole + camera topics)
ros2 run gressus_game tile_game_node
```

Game and calibration read/write `config/calibration.json` at the repo root (`/gressus/config/…` in Docker).

The web **Control** panel starts the game via `ros2 run gressus_game tile_game_node` automatically when the backend runs with ROS sourced.

### Calibration (AprilTag)

```bash
source /opt/ros/jazzy/setup.bash
source /gressus/ros2_ws/install/setup.bash
ros2 run gressus_calibration calibrate_apriltag -- \
  -c realsense --width 640 --height 480 --fps 30 \
  --display 0 --tag-size 280 --margin 30
```

### Tile game flags (after `--`)

Two lanes; a hit requires **D AND R AND P**:

1. **D** — depth pixels lifted above the baseline floor.
2. **R** — pixels not lit by the projector (foot occlusion).
3. **P** — insole pressure above `--insole-thresh-kpa` from `/insole/pressure`.

`--demo` — no camera topics (auto-press). `--no-insole` — skip pressure gate. `-S` / `--speed`, `--step-time-s`, `-d`, `--output-rotation`.

**Session flow:** stand outside the projection zone → `SPACE` (floor baseline + start) → step on tiles alternately → `R` reset, `Esc`/`Q` quit.

## 4. Documentation

| Document                                                           | Description                                   |
| ------------------------------------------------------------------ | --------------------------------------------- |
| [docs/BACKEND.md](docs/BACKEND.md)                                 | FastAPI layout: modules, services, app_state  |
| [docs/occlusion-and-treadmill.md](docs/occlusion-and-treadmill.md) | Shadow, occlusion, why depth, lighting, setup |
| [docs/system-spec.md](docs/system-spec.md)                         | Hardware, D435 pipeline, checklist            |
| [docs/roadmap.md](docs/roadmap.md)                                 | Development vectors, priorities, 3–6 month plan |
