"""ROS 2 node: P.GEAR device control via pgear_tools Esp32Link (UDP + TCP)."""

from __future__ import annotations

import json
import threading
import time

import rclpy
from rclpy.callback_groups import ReentrantCallbackGroup
from rclpy.executors import MultiThreadedExecutor
from rclpy.node import Node
from rclpy.qos import QoSDurabilityPolicy, QoSHistoryPolicy, QoSProfile
from std_srvs.srv import Trigger

from gressus_msgs.msg import PgearCalibrationStatus, PgearTelemetry
from gressus_msgs.srv import CalibratePgearBaseline, LoadPgearProfile
from gressus_pgear.baseline_calibration import run_baseline_calibration
from gressus_pgear.esp32_adapter import Esp32Adapter
from gressus_pgear.ros_msg import empty_msg
from gressus_pgear.telemetry_hub import TelemetryHub
from gressus_pgear.telemetry_mapper import telemetry_to_msg
from gressus_pgear.ws_server import PgearWsServer


class PgearDeviceNode(Node):
    def __init__(self) -> None:
        super().__init__("pgear_device_node")
        self.declare_parameter("esp_host", "")
        self.declare_parameter("publish_hz", 100.0)
        self.declare_parameter("stale_after_s", 0.5)
        self.declare_parameter("topic", "/exoskeleton/telemetry")
        self.declare_parameter("frame_id", "exoskeleton")
        self.declare_parameter("serve_ws", True)
        self.declare_parameter("ws_host", "0.0.0.0")
        self.declare_parameter("ws_port", 8766)
        self.declare_parameter("ws_path", "/ws/exoskeleton")
        self.declare_parameter("ws_hz", 20.0)

        esp_host = str(self.get_parameter("esp_host").value).strip() or None
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
        self._armed = False
        self._last_cps = 0.36
        self._cal_lock = threading.Lock()
        self._cal_running = False
        self._cal_cancel = False
        self._cal_run_id = 0
        self._cal_thread: threading.Thread | None = None
        self._adapter = Esp32Adapter(esp_host=esp_host)
        self._adapter.start()
        self._telemetry_hub = TelemetryHub()

        self._pub = self.create_publisher(PgearTelemetry, topic, 10)
        self.create_timer(1.0 / max(hz, 1.0), self._publish)

        # Latched status so a late subscriber (session_manager) always gets the
        # latest calibration state.
        latched_qos = QoSProfile(
            depth=1,
            history=QoSHistoryPolicy.KEEP_LAST,
            durability=QoSDurabilityPolicy.TRANSIENT_LOCAL,
        )
        self._cal_status_pub = self.create_publisher(
            PgearCalibrationStatus, "/exoskeleton/calibration_status", latched_qos
        )
        self._publish_cal_status(state="idle", message="no calibration run yet")

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

        srv_group = ReentrantCallbackGroup()
        self.create_service(Trigger, "~/estop", self._handle_estop, callback_group=srv_group)
        self.create_service(Trigger, "~/estop_reset", self._handle_estop_reset, callback_group=srv_group)
        self.create_service(Trigger, "~/arm", self._handle_arm, callback_group=srv_group)
        self.create_service(Trigger, "~/disarm", self._handle_disarm, callback_group=srv_group)
        self.create_service(Trigger, "~/full_cal", self._handle_full_cal, callback_group=srv_group)
        self.create_service(Trigger, "~/run", self._handle_run, callback_group=srv_group)
        self.create_service(Trigger, "~/stop_gait", self._handle_stop_gait, callback_group=srv_group)
        self.create_service(LoadPgearProfile, "~/load_profile", self._handle_load_profile, callback_group=srv_group)
        self.create_service(
            CalibratePgearBaseline,
            "~/calibrate_baseline",
            self._handle_calibrate_baseline,
            callback_group=srv_group,
        )
        self.create_service(
            Trigger, "~/cancel_calibrate", self._handle_cancel_calibrate, callback_group=srv_group
        )

        host_label = esp_host or "auto"
        ws_label = f", WebSocket ws://{ws_host}:{ws_port}{ws_path}" if serve_ws else ""
        self.get_logger().info(
            f"P.GEAR device node: esp_host={host_label} -> {topic} @ {hz:.1f} Hz "
            f"(stale>{self._stale_after_s:.2f}s){ws_label}"
        )

    def _publish_msg(self, msg: PgearTelemetry) -> None:
        self._pub.publish(msg)
        self._telemetry_hub.update(msg)

    def _publish_disconnected(self, stamp, *, error: str) -> None:
        msg = empty_msg(stamp, connected=False, error=error, frame_id=self._frame_id)
        self._pub.publish(msg)
        self._telemetry_hub.update_disconnected(error=error)

    def _publish(self) -> None:
        stamp = self.get_clock().now().to_msg()
        telemetry, age_s, connected, error = self._adapter.latest_snapshot(self._stale_after_s)

        if telemetry is None:
            self._publish_disconnected(stamp, error=error or "waiting for telemetry")
            return

        if not connected:
            self._publish_disconnected(stamp, error=error or "disconnected")
            return

        self._publish_msg(
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
        self._armed = False
        return self._trigger("estop", self._adapter.estop)

    def _handle_estop_reset(
        self, _request: Trigger.Request, _response: Trigger.Response
    ) -> Trigger.Response:
        return self._trigger("estop_reset", self._adapter.estop_reset)

    def _handle_arm(self, _request: Trigger.Request, _response: Trigger.Response) -> Trigger.Response:
        response = self._trigger("arm", self._adapter.arm)
        if response.success:
            self._armed = True
        return response

    def _handle_disarm(self, _request: Trigger.Request, _response: Trigger.Response) -> Trigger.Response:
        response = self._trigger("disarm", self._adapter.disarm)
        if response.success:
            self._armed = False
        return response

    def _handle_full_cal(self, _request: Trigger.Request, _response: Trigger.Response) -> Trigger.Response:
        response = Trigger.Response()
        if self._armed:
            response.success = False
            response.message = "full_cal: disarm first (ODrive cal runs from IDLE)"
            self.get_logger().warn(response.message)
            return response
        return self._trigger("full_cal", self._adapter.full_cal)

    def _handle_run(self, _request: Trigger.Request, _response: Trigger.Response) -> Trigger.Response:
        if not self._armed:
            response = Trigger.Response()
            response.success = False
            response.message = "run: arm first"
            self.get_logger().warn(response.message)
            return response
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
        if "cps" in profile:
            self._last_cps = float(profile["cps"])
        response.success = True
        response.message = f"loaded keys={list(profile.keys())}"
        self.get_logger().info(response.message)
        return response

    def _publish_cal_status(
        self,
        *,
        state: str,
        message: str = "",
        elapsed_s: float = 0.0,
        remaining_s: float = 0.0,
        progress: float = 0.0,
        coeffs_json: str = "",
    ) -> None:
        msg = PgearCalibrationStatus()
        msg.state = state
        msg.message = message
        msg.elapsed_s = float(elapsed_s)
        msg.remaining_s = float(remaining_s)
        msg.progress = float(progress)
        msg.run_id = int(self._cal_run_id)
        msg.coeffs_json = coeffs_json
        self._cal_status_pub.publish(msg)

    def _handle_calibrate_baseline(
        self,
        request: CalibratePgearBaseline.Request,
        response: CalibratePgearBaseline.Response,
    ) -> CalibratePgearBaseline.Response:
        """Start calibration in the background and return immediately.

        Progress and the final result (with coeffs) are published on the latched
        ``/exoskeleton/calibration_status`` topic — calibration runs 30-130 s, so
        it cannot block a single request/response.
        """
        with self._cal_lock:
            if self._cal_running:
                response.success = False
                response.message = "calibrate_baseline: already running"
                return response
            self._cal_running = True
            self._cal_cancel = False
            self._cal_run_id += 1

        duration_s = float(request.duration_s)
        self._publish_cal_status(
            state="running",
            message="calibration started — keep ARM+RUN",
            remaining_s=duration_s or 30.0,
        )
        self._cal_thread = threading.Thread(
            target=self._run_calibration, args=(duration_s,), name="pgear-cal", daemon=True
        )
        self._cal_thread.start()
        self.get_logger().info(
            f"calibrate_baseline: started run #{self._cal_run_id} (~{duration_s or 30.0:.0f}s)"
        )
        response.success = True
        response.message = f"started (run_id={self._cal_run_id})"
        return response

    def _run_calibration(self, duration_s: float) -> None:
        last_pub = 0.0

        def progress_cb(elapsed: float, remaining: float) -> None:
            nonlocal last_pub
            now = time.monotonic()
            if now - last_pub < 0.5:
                return
            last_pub = now
            total = elapsed + remaining
            progress = (elapsed / total) if total > 0 else 0.0
            self._publish_cal_status(
                state="running",
                message="calibrating",
                elapsed_s=elapsed,
                remaining_s=remaining,
                progress=min(1.0, max(0.0, progress)),
            )

        try:
            ok, message, payload = run_baseline_calibration(
                self._adapter,
                duration_s=duration_s,
                stale_after_s=self._stale_after_s,
                cps=self._last_cps,
                progress_cb=progress_cb,
                should_cancel=lambda: self._cal_cancel,
            )
        except Exception as exc:  # never let the worker die silently
            ok, message, payload = False, f"calibration crashed: {exc}", None

        if message == "cancelled":
            state = "cancelled"
        elif ok:
            state = "done"
        else:
            state = "failed"
        coeffs_json = json.dumps(payload) if (ok and payload) else ""
        self._publish_cal_status(
            state=state, message=message, progress=1.0 if ok else 0.0, coeffs_json=coeffs_json
        )
        if ok:
            self.get_logger().info(f"calibrate_baseline: {message}")
        else:
            self.get_logger().warn(f"calibrate_baseline: {message}")
        with self._cal_lock:
            self._cal_running = False
            self._cal_cancel = False

    def _handle_cancel_calibrate(
        self, _request: Trigger.Request, response: Trigger.Response
    ) -> Trigger.Response:
        with self._cal_lock:
            running = self._cal_running
            if running:
                self._cal_cancel = True
        response.success = True
        response.message = "cancel requested" if running else "no calibration running"
        return response

    def destroy_node(self) -> bool:
        if self._ws_server is not None:
            self._ws_server.stop()
            self._ws_server = None
        self._adapter.stop()
        return super().destroy_node()


def main(args=None) -> None:
    rclpy.init(args=args)
    node = PgearDeviceNode()
    executor = MultiThreadedExecutor(num_threads=4)
    executor.add_node(node)
    try:
        executor.spin()
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
