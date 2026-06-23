# Third-party dependencies

## `pgear_tools`

Upstream: [Keikibayev/pgear_tools](https://github.com/Keikibayev/pgear_tools)  
Branch: `feature/patient-profiles-cp-support`

Gressus uses `pi_gui/pgear_pi/transport/esp32_link.py` from the ROS package
`gressus_pgear` (direct device control — no WebSocket bridge).

**Python import path** (`pgear_pi` is not an ament package):

`docker/ros-env.sh` sets `PYTHONPATH` (Docker entrypoint and interactive shells).

Override repo root with `GRESSUS_REPO_ROOT` if not at `/gressus`.

To register as a git submodule (recommended for production):

```bash
git submodule add -b feature/patient-profiles-cp-support \
  https://github.com/Keikibayev/pgear_tools.git third_party/pgear_tools
```

Bump intentionally after upstream protocol changes; do not fork unless necessary.
