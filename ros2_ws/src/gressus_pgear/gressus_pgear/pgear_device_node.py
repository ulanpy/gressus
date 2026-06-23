"""ROS 2 node: P.GEAR device control via pgear_tools Esp32Link (UDP + TCP)."""

import json

import rclpy
from rclpy.node import Node
from std_srvs.srv import Trigger

from gressus_msgs.msg import PgearTelemetry
from gressus_msgs.srv import LoadPgearProfile
from gressus_pgear.esp32_adapter import Esp32Adapter
from gressus_pgear.ros_msg import empty_msg
from gressus_pgear.telemetry_mapper import telemetry_to_msg


class PgearDeviceNode(Node):
    def __init__(self) -> None:
        super().__init__("pgear_device_node")
        self.declare_parameter("esp_host", "")
        self.declare_parameter("publish_hz", 100.0)
        self.declare_parameter("stale_after_s", 0.5)
        self.declare_parameter("topic", "/exoskeleton/telemetry")
        self.declare_parameter("frame_id", "exoskeleton")

        esp_host = str(self.get_parameter("esp_host").value).strip() or None
        hz = float(self.get_parameter("publish_hz").value)
        self._stale_after_s = float(self.get_parameter("stale_after_s").value)
        topic = str(self.get_parameter("topic").value)
        frame_id = str(self.get_parameter("frame_id").value)

        self._frame_id = frame_id
        self._adapter = Esp32Adapter(esp_host=esp_host)
        self._adapter.start()

        self._pub = self.create_publisher(PgearTelemetry, topic, 10)
        self.create_timer(1.0 / max(hz, 1.0), self._publish)

        self.create_service(Trigger, "~/estop", self._handle_estop)
        self.create_service(Trigger, "~/arm", self._handle_arm)
        self.create_service(Trigger, "~/disarm", self._handle_disarm)
        self.create_service(Trigger, "~/run", self._handle_run)
        self.create_service(Trigger, "~/stop_gait", self._handle_stop_gait)
        self.create_service(LoadPgearProfile, "~/load_profile", self._handle_load_profile)

        host_label = esp_host or "auto"
        self.get_logger().info(
            f"P.GEAR device node: esp_host={host_label} -> {topic} @ {hz:.1f} Hz "
            f"(stale>{self._stale_after_s:.2f}s)"
        )

    def _publish(self) -> None:
        stamp = self.get_clock().now().to_msg()
        telemetry, age_s, connected, error = self._adapter.latest_snapshot(self._stale_after_s)

        if telemetry is None:
            self._pub.publish(
                empty_msg(
                    stamp,
                    connected=False,
                    error=error or "waiting for telemetry",
                    frame_id=self._frame_id,
                )
            )
            return

        if not connected:
            self._pub.publish(
                empty_msg(
                    stamp,
                    connected=False,
                    error=error or "disconnected",
                    frame_id=self._frame_id,
                )
            )
            return

        self._pub.publish(
            telemetry_to_msg(
                telemetry,
                stamp,
                frame_id=self._frame_id,
                tcp_connected=self._adapter.tcp_connected(),
                telem_age_s=age_s,
                stale_after_s=self._stale_after_s,
            )
        )

    def _trigger(self, action: str, fn) -> Trigger.Response:
        response = Trigger.Response()
        ok = bool(fn())
        response.success = ok
        response.message = f"{action}: {'ok' if ok else 'failed (TCP link?)'}"
        if not ok:
            self.get_logger().warn(response.message)
        return response

    def _handle_estop(self, _request: Trigger.Request, _response: Trigger.Response) -> Trigger.Response:
        return self._trigger("estop", self._adapter.estop)

    def _handle_arm(self, _request: Trigger.Request, _response: Trigger.Response) -> Trigger.Response:
        return self._trigger("arm", self._adapter.arm)

    def _handle_disarm(self, _request: Trigger.Request, _response: Trigger.Response) -> Trigger.Response:
        return self._trigger("disarm", self._adapter.disarm)

    def _handle_run(self, _request: Trigger.Request, _response: Trigger.Response) -> Trigger.Response:
        return self._trigger("run", self._adapter.run)

    def _handle_stop_gait(self, _request: Trigger.Request, _response: Trigger.Response) -> Trigger.Response:
        return self._trigger("stop_gait", self._adapter.stop_gait)

    def _handle_load_profile(
        self,
        request: LoadPgearProfile.Request,
        response: LoadPgearProfile.Response,
    ) -> LoadPgearProfile.Response:
        try:
            profile = self._adapter.load_profile_json(request.profile_json)
        except (json.JSONDecodeError, ValueError, TypeError) as exc:
            response.success = False
            response.message = str(exc)
            self.get_logger().error(f"load_profile: {exc}")
            return response
        response.success = True
        response.message = f"loaded keys={list(profile.keys())}"
        self.get_logger().info(response.message)
        return response

    def destroy_node(self) -> bool:
        self._adapter.stop()
        return super().destroy_node()


def main(args=None) -> None:
    rclpy.init(args=args)
    node = PgearDeviceNode()
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
