#!/usr/bin/env bash
# Source ROS 2 underlay + mounted workspace overlay.
set +u
source /opt/ros/jazzy/setup.bash
if [ -f /gressus/ros2_ws/install/setup.bash ]; then
  # shellcheck disable=SC1091
  source /gressus/ros2_ws/install/setup.bash
fi
