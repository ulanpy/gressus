# ROS 2 runtime

Workspace: `ros2_ws/src/`. Inside Docker, the entrypoint builds the workspace and starts `session_manager` on `http://127.0.0.1:9090`.

Interactive shell (auto-sources ROS):

```bash
docker compose exec ros2 bash
```

Manual session manager (if not started by entrypoint):

```bash
ros2 run gressus_session session_manager -- --host 127.0.0.1 --port 9090
```

## Session manager HTTP API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/session/status` | Active launch job, clinical context |
| `POST` | `/session/start` | Spawn a launch stack |
| `POST` | `/session/stop` | Stop active launch job |
| `POST` | `/session/pgear/load-profile` | Load exo profile JSON |
| `POST` | `/session/pgear/arm` | Arm exoskeleton |
| `POST` | `/session/pgear/disarm` | Disarm |
| `POST` | `/session/pgear/run` | Start gait |
| `POST` | `/session/pgear/stop-gait` | Stop gait |
| `POST` | `/session/pgear/estop` | Emergency stop |
| `POST` | `/session/pgear/estop-reset` | Clear faults after E-STOP |
| `POST` | `/session/pgear/full-cal` | ODrive FULL CAL (DISARM only) |
| `POST` | `/session/pgear/calibrate-baseline` | Empty-exo baseline fit (~30 s, ARM+RUN) |

The backend proxies these via `/api/runtime/*` — see [BACKEND.md](BACKEND.md).

## P.GEAR node (standalone)

```bash
ros2 launch gressus_bringup pgear.launch.py esp_host:=<ESP32_IP>

# or bare node
ros2 run gressus_pgear pgear_device_node --ros-args -p esp_host:=<ESP32_IP>
```

Services (under `/pgear_device_node/`): `load_profile`, `arm`, `disarm`, `run`, `stop_gait`, `estop`, `estop_reset`, `full_cal`, `calibrate_baseline`.  
Telemetry topic: `/exoskeleton/telemetry`.

Full protocol and profile format: [../ros2_ws/src/gressus_pgear/README.md](../ros2_ws/src/gressus_pgear/README.md).

## Individual launch files

```bash
ros2 launch gressus_bringup insole.launch.py
ros2 launch gressus_bringup pgear.launch.py esp_host:=<ESP32_IP>
ros2 launch gressus_bringup tile_game.launch.py mode:=camera
ros2 launch gressus_bringup calibrate.launch.py
```

### RealSense preview

For a quick visual check of the RealSense colour and aligned depth streams,
run this instead of a launch that already owns the camera:

```bash
python3 /gressus/ros2_ws/tools/realsense_depth_preview.py --align-to-color
```

The preview prints the active profile, FPS, and USB mode. Press `Q` or `Esc`
to close it.

### Backend / UI launch mapping

| Trigger | Launch file |
|---------|-------------|
| Full: camera + insoles | `tile_game.launch.py mode:=full` |
| Camera only | `tile_game.launch.py mode:=camera` |
| Demo: no sensors | `tile_game.launch.py mode:=demo` |
| Calibrate from Control | `calibrate.launch.py` |

## Calibration (AprilTag)

Camera–projector alignment for the tile game. Output: `config/calibration.json`.

```bash
ros2 launch gressus_bringup calibrate.launch.py output_rotation:=270
```

`output_rotation` must match the game launch. Re-run after moving camera or projector.

Bare node (different defaults — prefer launch file for the treadmill rig):

```bash
ros2 run gressus_calibration calibrate_apriltag -- --help
```

## Tile game (optional)

Projector lanes with depth + insole hit gate (**D AND R AND P**). Theory and setup: [occlusion-and-treadmill.md](occlusion-and-treadmill.md).

```bash
ros2 launch gressus_bringup tile_game.launch.py \
  output_rotation:=270 \
  insole_thresh_kpa:=8 \
  speed:=0.35 \
  step_time_s:=2.5
```

## Manual node runs

```bash
ros2 run gressus_insole insole_bridge_node
ros2 run gressus_realsense realsense_node
ros2 run gressus_game tile_game_node
```

## Environment

| Variable | Set by | Purpose |
|----------|--------|---------|
| `GRESSUS_SESSION_ID` | session_manager | Clinical session uuid |
| `GRESSUS_PATIENT_ID` | session_manager | Patient uuid |
| `GRESSUS_SESSION_DATA_DIR` | session_manager | Recording output path |
| `GRESSUS_SESSION_DATA_ROOT` | host env | Base dir (default `/data/sessions`) |
| `GRESSUS_PGEAR_NODE_NAME` | optional | P.GEAR node name for rclpy client |
| `PYTHONPATH` | `docker/ros-env.sh` | `third_party/pgear_tools/pi_gui` |

Game and calibration read `config/calibration.json` at the repo root (`/gressus/config/…` in Docker).
