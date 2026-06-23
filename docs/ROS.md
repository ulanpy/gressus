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

The backend proxies these via `/api/runtime/*` — see [BACKEND.md](BACKEND.md).

## Primary stack — clinical feedback

Started from the web Control panel or backend with `job: "feedback"`:

```bash
ros2 launch gressus_bringup feedback.launch.py esp_host:=<ESP32_IP>
```

Includes insole bridge, RealSense camera, and `pgear_device_node`.

Optional launch arguments:

```bash
ros2 launch gressus_bringup feedback.launch.py \
  esp_host:=192.168.1.100 \
  insole_thresh_kpa:=8.0
```

## P.GEAR node (standalone)

```bash
ros2 launch gressus_bringup pgear.launch.py esp_host:=<ESP32_IP>

# or bare node
ros2 run gressus_pgear pgear_device_node --ros-args -p esp_host:=<ESP32_IP>
```

Services (under `/pgear_device_node/`): `load_profile`, `arm`, `disarm`, `run`, `stop_gait`, `estop`.  
Telemetry topic: `/exoskeleton/telemetry`.

Full protocol and profile format: [../ros2_ws/src/gressus_pgear/README.md](../ros2_ws/src/gressus_pgear/README.md).

## Individual launch files

```bash
ros2 launch gressus_bringup insole.launch.py
ros2 launch gressus_bringup camera.launch.py
ros2 launch gressus_bringup pgear.launch.py esp_host:=<ESP32_IP>
ros2 launch gressus_bringup game.launch.py
ros2 launch gressus_bringup game_camera.launch.py
ros2 launch gressus_bringup calibrate.launch.py
ros2 launch gressus_bringup session.launch.py speed:=0.35 step_time_s:=2.5
```

### Backend / UI launch mapping

| Trigger | Launch file |
|---------|-------------|
| `job: feedback` | `feedback.launch.py` |
| Demo mode | `game.launch.py` |
| No insoles | `game_camera.launch.py` |
| Default game session | `session.launch.py` |
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
ros2 launch gressus_bringup game.launch.py \
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
