#!/usr/bin/env bash
set -eo pipefail

ensure_ros_bashrc() {
  local marker="# gressus-ros-env"
  local snippet="source /gressus/docker/ros-env.sh 2>/dev/null || source /usr/local/bin/gressus-ros-env.sh"
  if ! grep -qF "$marker" /root/.bashrc 2>/dev/null; then
    {
      echo ""
      echo "$marker"
      echo "$snippet"
    } >> /root/.bashrc
  fi
}

# shellcheck disable=SC1091
source /gressus/docker/ros-env.sh

if [ -f /gressus/docker/gui-env.sh ]; then
  # shellcheck disable=SC1091
  source /gressus/docker/gui-env.sh
elif [ -f /usr/local/bin/gressus-gui-env.sh ]; then
  # shellcheck disable=SC1091
  source /usr/local/bin/gressus-gui-env.sh
fi

ensure_ros_bashrc

if [ -d /gressus/ros2_ws/src ] && [ -n "$(find /gressus/ros2_ws/src -mindepth 1 -maxdepth 1 -type d 2>/dev/null | head -1)" ]; then
  cd /gressus/ros2_ws
  rosdep install --from-paths src --ignore-src -r -y || true
  stale_cache=$(find build -name CMakeCache.txt -print -quit 2>/dev/null || true)
  if [ -n "$stale_cache" ] && grep -q '/root/ros2_ws' "$stale_cache" 2>/dev/null; then
    echo "[entrypoint] stale colcon artifacts (old /root/ros2_ws paths) — cleaning build/install/log"
    rm -rf build install log
  fi
  colcon build --symlink-install
  # shellcheck disable=SC1091
  source /gressus/docker/ros-env.sh
else
  echo "[entrypoint] ros2_ws/src is empty — skipping colcon build"
fi

exec "$@"
