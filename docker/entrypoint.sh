#!/usr/bin/env bash
set -eo pipefail

# ROS setup.bash reads optional vars; `set -u` breaks on AMENT_TRACE_SETUP_FILES.
set +u
source /opt/ros/jazzy/setup.bash
set -u

if [ -f /gressus/docker/gui-env.sh ]; then
  # shellcheck disable=SC1091
  source /gressus/docker/gui-env.sh
elif [ -f /usr/local/bin/gressus-gui-env.sh ]; then
  # shellcheck disable=SC1091
  source /usr/local/bin/gressus-gui-env.sh
fi

if [ -d /gressus/ros2_ws/src ] && [ -n "$(find /gressus/ros2_ws/src -mindepth 1 -maxdepth 1 -type d 2>/dev/null | head -1)" ]; then
  cd /gressus/ros2_ws
  stale_cache=$(find build -name CMakeCache.txt -print -quit 2>/dev/null || true)
  if [ -n "$stale_cache" ] && grep -q '/root/ros2_ws' "$stale_cache" 2>/dev/null; then
    echo "[entrypoint] stale colcon artifacts (old /root/ros2_ws paths) — cleaning build/install/log"
    rm -rf build install log
  fi
  rosdep install --from-paths src --ignore-src -r -y || true
  colcon build --symlink-install
  if [ -f /gressus/ros2_ws/install/setup.bash ]; then
    set +u
    # shellcheck disable=SC1091
    source /gressus/ros2_ws/install/setup.bash
    set -u
  fi
else
  echo "[entrypoint] ros2_ws/src is empty — skipping colcon build"
fi

exec "$@"
