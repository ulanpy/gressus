#!/usr/bin/env bash
# Source ROS 2 underlay + mounted workspace overlay.
set +u
source /opt/ros/jazzy/setup.bash
if [ -f /gressus/ros2_ws/install/setup.bash ]; then
  # shellcheck disable=SC1091
  source /gressus/ros2_ws/install/setup.bash
fi
# pgear_tools (Esp32Link) — see third_party/README.md
_GRESSUS_ROOT="${GRESSUS_REPO_ROOT:-/gressus}"
_PI_GUI="$_GRESSUS_ROOT/third_party/pgear_tools/pi_gui"
if [ -d "$_PI_GUI" ]; then
  export PYTHONPATH="$_PI_GUI${PYTHONPATH:+:$PYTHONPATH}"
fi
