"""ROS 2 node: TCP insole bridge -> /insole/pressure."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import rclpy
from rclpy.node import Node

from gressus_msgs.msg import InsolePressure


def _ensure_gressus_path() -> None:
    root = Path(os.environ.get("GRESSUS_ROOT", "/gressus")).resolve()
    root_str = str(root)
    if root_str not in sys.path:
        sys.path.insert(0, root_str)


class InsoleBridgeNode(Node):
    def __init__(self) -> None:
        super().__init__("insole_bridge_node")
        self.declare_parameter("host", "0.0.0.0")
        self.declare_parameter("port", 9100)
        self.declare_parameter("threshold_kpa", 8.0)
        self.declare_parameter("publish_hz", 50.0)
        self.declare_parameter("topic", "/insole/pressure")

        host = str(self.get_parameter("host").value)
        port = int(self.get_parameter("port").value)
        self._threshold_kpa = float(self.get_parameter("threshold_kpa").value)
        hz = float(self.get_parameter("publish_hz").value)
        topic = str(self.get_parameter("topic").value)

        from shared.insole_tcp_receiver import InsoleTcpReceiver
        from shared.insole_types import N_SENSORS

        self._n_sensors = N_SENSORS
        self._receiver = InsoleTcpReceiver(host, port)
        self._receiver.start()
        self._pub = self.create_publisher(InsolePressure, topic, 10)
        self.create_timer(1.0 / max(hz, 1.0), self._publish)
        self.get_logger().info(
            f"listening on {host}:{port}, publishing {topic} @ {hz:.1f} Hz"
        )

    def _publish(self) -> None:
        snap = self._receiver.latest_snapshot(self._threshold_kpa)
        msg = InsolePressure()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = "insole"

        left = snap.left
        right = snap.right
        msg.left = [0.0] * self._n_sensors
        msg.right = [0.0] * self._n_sensors
        if left is not None:
            msg.left = [float(x) for x in left[: self._n_sensors]]
        if right is not None:
            msg.right = [float(x) for x in right[: self._n_sensors]]

        msg.left_max_kpa = float(snap.left_stats.max_kpa)
        msg.right_max_kpa = float(snap.right_stats.max_kpa)
        msg.left_mean_kpa = float(snap.left_stats.mean_kpa)
        msg.right_mean_kpa = float(snap.right_stats.mean_kpa)
        msg.left_pressed = bool(snap.left_stats.pressed)
        msg.right_pressed = bool(snap.right_stats.pressed)
        msg.connected = bool(snap.connected)
        msg.age_s = float(snap.age_s) if snap.age_s is not None else -1.0
        msg.error = snap.error or ""
        self._pub.publish(msg)

    def destroy_node(self) -> bool:
        self._receiver.stop()
        return super().destroy_node()


def main(args=None) -> None:
    _ensure_gressus_path()
    rclpy.init(args=args)
    node = InsoleBridgeNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
