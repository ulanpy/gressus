"""ROS 2 publisher for raw high-frequency EMG frames."""

from __future__ import annotations

import rclpy
from rclpy.node import Node

from gressus_msgs.msg import EmgFrame


class EmgBridgeNode(Node):
    def __init__(self) -> None:
        super().__init__("emg_bridge_node")
        self.declare_parameter("host", "0.0.0.0")
        self.declare_parameter("port", 9101)
        self.declare_parameter("topic", "/emg/raw")
        self.declare_parameter("drain_hz", 100.0)
        self.declare_parameter("max_frames_per_tick", 16)
        self.declare_parameter("serve_ws", True)
        self.declare_parameter("ws_host", "0.0.0.0")
        self.declare_parameter("ws_port", 8767)
        self.declare_parameter("ws_path", "/ws/emg")
        self.declare_parameter("ws_hz", 10.0)

        host = str(self.get_parameter("host").value)
        port = int(self.get_parameter("port").value)
        topic = str(self.get_parameter("topic").value)
        drain_hz = float(self.get_parameter("drain_hz").value)
        self._max_frames_per_tick = int(self.get_parameter("max_frames_per_tick").value)

        from gressus_insole.emg_tcp_receiver import EmgTcpReceiver

        self._receiver = EmgTcpReceiver(host, port)
        self._receiver.start()
        self._ws_server = None
        if bool(self.get_parameter("serve_ws").value):
            from gressus_insole.emg_ws_server import EmgWsServer

            self._ws_server = EmgWsServer(
                self._receiver,
                host=str(self.get_parameter("ws_host").value),
                port=int(self.get_parameter("ws_port").value),
                path=str(self.get_parameter("ws_path").value),
                default_hz=float(self.get_parameter("ws_hz").value),
            )
            self._ws_server.start()
        self._publisher = self.create_publisher(EmgFrame, topic, 256)
        self._last_dropped = 0
        self._last_error: str | None = None
        self.create_timer(1.0 / max(1.0, drain_hz), self._publish_available)
        self.get_logger().info(
            f"EMG TCP {host}:{port} -> {topic}; binary raw-frame ingest enabled"
        )

    def _publish_available(self) -> None:
        for frame in self._receiver.drain(self._max_frames_per_tick):
            msg = EmgFrame()
            # The sender does not expose a hardware timebase. This is reception
            # time, while frame_seq allows offline gap detection.
            msg.header.stamp = self.get_clock().now().to_msg()
            msg.header.frame_id = "cometa_emg"
            msg.frame_seq = int(frame.frame_seq)
            msg.sample_rate_hz = int(frame.sample_rate_hz)
            msg.samples_per_channel = int(frame.samples_per_channel)
            msg.sensor_slots = list(frame.sensor_slots)
            msg.samples = list(frame.samples)
            self._publisher.publish(msg)

        _connected, error, dropped = self._receiver.status()
        if error and error != self._last_error:
            self.get_logger().warn(f"EMG TCP receive error: {error}")
        self._last_error = error
        if dropped > self._last_dropped:
            self.get_logger().error(
                f"EMG receiver dropped {dropped - self._last_dropped} frame(s); total={dropped}"
            )
            self._last_dropped = dropped

    def destroy_node(self) -> bool:
        if self._ws_server is not None:
            self._ws_server.stop()
        self._receiver.stop()
        return super().destroy_node()


def main(args=None) -> None:
    rclpy.init(args=args)
    node = EmgBridgeNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
