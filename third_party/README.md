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

## `pgear_v8_firmware`

Upstream: [Keikibayev/pgear_v8_firmware](https://github.com/Keikibayev/pgear_v8_firmware)  
Branch: `feature/torque-assist-ops`

ESP32-S3 main-controller firmware — the device twin of `pgear_tools`. Source of
truth for the wire protocol (`pgear_main/protocol.h`) and the external control
ICD (`docs/API.md`, §7 patient-profile schema). Reference only; not built by
Gressus (flashed to the ESP32 separately).

To register as a git submodule:

```bash
git submodule add -b feature/torque-assist-ops \
  https://github.com/Keikibayev/pgear_v8_firmware.git third_party/pgear_v8_firmware
```

This branch adds the **torque-mode tunables** (opcodes 35–39: `SET_TORQUE_ASSIST`,
`SET_FREE_RUN`, `SET_TORQUE_CAP`, `SET_LIMB_WEIGHT`, `SET_KNEE_ASSIST`) on top of
the position-mode profile fields — see `docs/API.md` §2.
