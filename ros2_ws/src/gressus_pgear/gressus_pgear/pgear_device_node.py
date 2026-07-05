"""ROS 2 node: P.GEAR UDP telemetry receiver (broadcast LogPacket → ROS topic)."""

from __future__ import annotations

import rclpy
from rclpy.node import Node

from gressus_msgs.msg import PgearTelemetry
from gressus_pgear.ros_msg import empty_msg
from gressus_pgear.telemetry_hub import TelemetryHub
from gressus_pgear.telemetry_mapper import telemetry_to_msg
from gressus_pgear.udp_receiver import UdpTelemetryReceiver
from gressus_pgear.ws_server import PgearWsServer


class PgearDeviceNode(Node):
    def __init__(self) -> None:
        super().__init__("pgear_device_node")
        self.declare_parameter("udp_port", 47000)
        self.declare_parameter("publish_hz", 100.0)
        self.declare_parameter("stale_after_s", 0.5)
        self.declare_parameter("topic", "/exoskeleton/telemetry")
        self.declare_parameter("frame_id", "exoskeleton")
        self.declare_parameter("serve_ws", True)
        self.declare_parameter("ws_host", "0.0.0.0")
        self.declare_parameter("ws_port", 8766)
        self.declare_parameter("ws_path", "/ws/exoskeleton")
        self.declare_parameter("ws_hz", 20.0)

        udp_port = int(self.get_parameter("udp_port").value)
        hz = float(self.get_parameter("publish_hz").value)
        self._stale_after_s = float(self.get_parameter("stale_after_s").value)
        topic = str(self.get_parameter("topic").value)
        frame_id = str(self.get_parameter("frame_id").value)
        serve_ws = bool(self.get_parameter("serve_ws").value)
        ws_host = str(self.get_parameter("ws_host").value)
        ws_port = int(self.get_parameter("ws_port").value)
        ws_path = str(self.get_parameter("ws_path").value)
        ws_hz = float(self.get_parameter("ws_hz").value)

        self._frame_id = frame_id
        self._logged_source: str | None = None
        self._receiver = UdpTelemetryReceiver(udp_port=udp_port)
        self._receiver.start()
        self._telemetry_hub = TelemetryHub()

        self._pub = self.create_publisher(PgearTelemetry, topic, 10)
        self.create_timer(1.0 / max(hz, 1.0), self._publish)

        self._ws_server: PgearWsServer | None = None
        if serve_ws:
            self._ws_server = PgearWsServer(
                self._telemetry_hub,
                host=ws_host,
                port=ws_port,
                path=ws_path,
                default_hz=ws_hz,
            )
            self._ws_server.start()

        ws_label = f", WebSocket ws://{ws_host}:{ws_port}{ws_path}" if serve_ws else ""
        self.get_logger().info(
            f"P.GEAR telemetry node: udp:{udp_port} -> {topic} @ {hz:.1f} Hz "
            f"(stale>{self._stale_after_s:.2f}s){ws_label}"
        )

    def _publish_msg(self, msg: PgearTelemetry) -> None:
        self._pub.publish(msg)
        self._telemetry_hub.update(msg)

    def _publish_disconnected(self, stamp, *, error: str) -> None:
        msg = empty_msg(stamp, connected=False, error=error, frame_id=self._frame_id)
        self._pub.publish(msg)
        self._telemetry_hub.update_disconnected(error=error)

    def _log_source(self) -> None:
        host = self._receiver.device_host()
        if host and host != self._logged_source:
            self.get_logger().info(f"ESP32 telemetry source {host} (UDP broadcast :47000)")
            self._logged_source = host

    def _publish(self) -> None:
        self._log_source()
        stamp = self.get_clock().now().to_msg()
        telemetry, age_s, connected, error = self._receiver.latest_snapshot(self._stale_after_s)

        if telemetry is None or not connected:
            self._publish_disconnected(stamp, error=error or "waiting for telemetry")
            return

        self._publish_msg(
            telemetry_to_msg(
                telemetry,
                stamp,
                frame_id=self._frame_id,
                telem_age_s=age_s,
                stale_after_s=self._stale_after_s,
            )
        )

    def destroy_node(self) -> bool:
        if self._ws_server is not None:
            self._ws_server.stop()
            self._ws_server = None
        self._receiver.stop()
        return super().destroy_node()


def main(args=None) -> None:
    rclpy.init(args=args)
    node = PgearDeviceNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
