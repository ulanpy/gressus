"""ROS 2 node: P.GEAR UDP broadcast ingest and telemetry publish."""

from __future__ import annotations

import rclpy
from rclpy.node import Node

from gressus_msgs.msg import PgearTelemetry
from gressus_pgear.constants import UDP_BROADCAST_PORT
from gressus_pgear.ros_msg import empty_msg, packet_to_msg
from gressus_pgear.udp_receiver import PgearUdpReceiver


class PgearBridgeNode(Node):
    def __init__(self) -> None:
        super().__init__("pgear_bridge_node")
        self.declare_parameter("host", "0.0.0.0")
        self.declare_parameter("port", UDP_BROADCAST_PORT)
        self.declare_parameter("publish_hz", 100.0)
        self.declare_parameter("stale_after_s", 0.5)
        self.declare_parameter("topic", "/exoskeleton/telemetry")
        self.declare_parameter("frame_id", "exoskeleton")

        host = str(self.get_parameter("host").value)
        port = int(self.get_parameter("port").value)
        hz = float(self.get_parameter("publish_hz").value)
        stale_after_s = float(self.get_parameter("stale_after_s").value)
        topic = str(self.get_parameter("topic").value)
        frame_id = str(self.get_parameter("frame_id").value)

        self._stale_after_s = stale_after_s
        self._frame_id = frame_id
        self._receiver = PgearUdpReceiver(host, port)
        self._receiver.start()
        self._pub = self.create_publisher(PgearTelemetry, topic, 10)
        self.create_timer(1.0 / max(hz, 1.0), self._publish)

        self.get_logger().info(
            f"UDP {host}:{port} -> {topic} @ {hz:.1f} Hz (stale>{stale_after_s:.2f}s => disconnected)"
        )

    def _publish(self) -> None:
        snap = self._receiver.latest_snapshot(self._stale_after_s)
        stamp = self.get_clock().now().to_msg()

        if snap.packet is None:
            msg = empty_msg(
                stamp,
                connected=False,
                error=snap.error or "waiting for UDP packets",
                frame_id=self._frame_id,
            )
            self._pub.publish(msg)
            return

        if not snap.connected:
            msg = empty_msg(
                stamp,
                connected=False,
                error=snap.error or f"stale telemetry (age={snap.age_s:.2f}s)",
                frame_id=self._frame_id,
            )
            self._pub.publish(msg)
            return

        self._pub.publish(packet_to_msg(snap.packet, stamp, frame_id=self._frame_id))

    def destroy_node(self) -> bool:
        self._receiver.stop()
        return super().destroy_node()


def main(args=None) -> None:
    rclpy.init(args=args)
    node = PgearBridgeNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        try:
            node.destroy_node()
        except Exception:
            pass
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
