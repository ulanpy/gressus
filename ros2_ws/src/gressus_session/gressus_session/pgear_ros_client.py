"""rclpy client for pgear_device_node services (called from HTTP session_manager)."""

from __future__ import annotations

import os
import threading
import time
from typing import Any

import rclpy
from gressus_msgs.msg import PgearCalibrationStatus, PgearTelemetry
from gressus_msgs.srv import CalibratePgearBaseline, LoadPgearProfile
from rclpy.node import Node
from rclpy.qos import QoSDurabilityPolicy, QoSHistoryPolicy, QoSProfile
from rclpy.time import Time
from std_srvs.srv import Trigger

_CAL_STATUS_TOPIC = "/exoskeleton/calibration_status"
_TELEMETRY_TOPIC = "/exoskeleton/telemetry"


class PgearRosClient:
    """Thread-safe ROS service client; one node, serialized calls."""

    def __init__(self, node_name: str | None = None) -> None:
        if not rclpy.ok():
            rclpy.init()
        self._node: Node = rclpy.create_node("gressus_session_pgear_client")
        self._lock = threading.Lock()
        self._device_node = node_name or os.environ.get("GRESSUS_PGEAR_NODE_NAME", "pgear_device_node")

    def _service(self, suffix: str) -> str:
        return f"/{self._device_node}/{suffix}"

    def _call_trigger(self, suffix: str, *, timeout_s: float = 10.0) -> dict[str, Any]:
        service = self._service(suffix)
        with self._lock:
            client = self._node.create_client(Trigger, service)
            try:
                if not client.wait_for_service(timeout_sec=5.0):
                    return {
                        "ok": False,
                        "success": False,
                        "message": f"service unavailable: {service}",
                    }
                future = client.call_async(Trigger.Request())
                rclpy.spin_until_future_complete(self._node, future, timeout_sec=timeout_s)
                if not future.done():
                    return {"ok": False, "success": False, "message": f"timeout: {service}"}
                result = future.result()
                if result is None:
                    return {"ok": False, "success": False, "message": f"call failed: {service}"}
                return {
                    "ok": True,
                    "success": bool(result.success),
                    "message": str(result.message),
                }
            finally:
                self._node.destroy_client(client)

    def load_profile(self, profile_json: str, *, timeout_s: float = 15.0) -> dict[str, Any]:
        service = self._service("load_profile")
        with self._lock:
            client = self._node.create_client(LoadPgearProfile, service)
            try:
                if not client.wait_for_service(timeout_sec=5.0):
                    return {
                        "ok": False,
                        "success": False,
                        "message": f"service unavailable: {service}",
                    }
                request = LoadPgearProfile.Request()
                request.profile_json = profile_json
                future = client.call_async(request)
                rclpy.spin_until_future_complete(self._node, future, timeout_sec=timeout_s)
                if not future.done():
                    return {"ok": False, "success": False, "message": f"timeout: {service}"}
                result = future.result()
                if result is None:
                    return {"ok": False, "success": False, "message": f"call failed: {service}"}
                return {
                    "ok": True,
                    "success": bool(result.success),
                    "message": str(result.message),
                }
            finally:
                self._node.destroy_client(client)

    def arm(self) -> dict[str, Any]:
        return self._call_trigger("arm")

    def disarm(self) -> dict[str, Any]:
        return self._call_trigger("disarm")

    def run(self) -> dict[str, Any]:
        return self._call_trigger("run")

    def stop_gait(self) -> dict[str, Any]:
        return self._call_trigger("stop_gait")

    def estop(self) -> dict[str, Any]:
        return self._call_trigger("estop")

    def estop_reset(self) -> dict[str, Any]:
        return self._call_trigger("estop_reset")

    def full_cal(self) -> dict[str, Any]:
        return self._call_trigger("full_cal")

    def cancel_calibrate(self) -> dict[str, Any]:
        return self._call_trigger("cancel_calibrate")

    def device_status(
        self,
        *,
        service_timeout_s: float = 0.5,
        telem_timeout_s: float = 0.5,
    ) -> dict[str, Any]:
        """Probe ``pgear_device_node`` services and latest telemetry freshness."""
        service = self._service("arm")
        node_available = False
        with self._lock:
            client = self._node.create_client(Trigger, service)
            try:
                node_available = client.wait_for_service(timeout_sec=service_timeout_s)
            finally:
                self._node.destroy_client(client)

        holder: dict[str, PgearTelemetry] = {}
        with self._lock:
            sub = self._node.create_subscription(
                PgearTelemetry,
                _TELEMETRY_TOPIC,
                lambda msg: holder.__setitem__("msg", msg),
                10,
            )
            try:
                deadline = time.time() + telem_timeout_s
                while "msg" not in holder and time.time() < deadline:
                    rclpy.spin_once(self._node, timeout_sec=0.1)
            finally:
                self._node.destroy_subscription(sub)
                
        # Получаем сообщение с телеметрией и оттуда вытаскиваем флаг connected
        msg = holder.get("msg")
        if msg is None:
            error = "no telemetry yet" if node_available else f"service unavailable: {service}"
            return {
                "nodeAvailable": node_available,
                "connected": False,
                "error": error,
            }
        error = str(msg.error).strip() or None
        return {
            "nodeAvailable": node_available,
            "connected": bool(msg.connected),
            "error": error,
        }

    def calibration_status(self, *, timeout_s: float = 1.5) -> dict[str, Any]:
        """Read the latest latched calibration status (transient_local topic)."""
        qos = QoSProfile(
            depth=1,
            history=QoSHistoryPolicy.KEEP_LAST,
            durability=QoSDurabilityPolicy.TRANSIENT_LOCAL,
        )
        holder: dict[str, PgearCalibrationStatus] = {}
        with self._lock:
            sub = self._node.create_subscription(
                PgearCalibrationStatus,
                _CAL_STATUS_TOPIC,
                lambda m: holder.__setitem__("msg", m),
                qos,
            )
            try:
                deadline = time.time() + timeout_s
                while "msg" not in holder and time.time() < deadline:
                    rclpy.spin_once(self._node, timeout_sec=0.1)
            finally:
                self._node.destroy_subscription(sub)

        msg = holder.get("msg")
        if msg is None:
            return {"ok": True, "state": "idle", "message": "no status yet"}
        return {
            "ok": True,
            "state": str(msg.state),
            "message": str(msg.message),
            "elapsedS": float(msg.elapsed_s),
            "remainingS": float(msg.remaining_s),
            "progress": float(msg.progress),
            "runId": int(msg.run_id),
            "coeffs": str(msg.coeffs_json) or None,
        }

    def calibrate_baseline(self, *, duration_s: float = 0.0, timeout_s: float = 15.0) -> dict[str, Any]:
        service = self._service("calibrate_baseline")
        with self._lock:
            client = self._node.create_client(CalibratePgearBaseline, service)
            try:
                if not client.wait_for_service(timeout_sec=5.0):
                    return {
                        "ok": False,
                        "success": False,
                        "message": f"service unavailable: {service}",
                    }
                request = CalibratePgearBaseline.Request()
                request.duration_s = float(duration_s)
                future = client.call_async(request)
                rclpy.spin_until_future_complete(self._node, future, timeout_sec=timeout_s)
                if not future.done():
                    return {"ok": False, "success": False, "message": f"timeout: {service}"}
                result = future.result()
                if result is None:
                    return {"ok": False, "success": False, "message": f"call failed: {service}"}
                return {
                    "ok": True,
                    "success": bool(result.success),
                    "message": str(result.message),
                }
            finally:
                self._node.destroy_client(client)


_CLIENT: PgearRosClient | None = None
_CLIENT_LOCK = threading.Lock()


def get_pgear_client() -> PgearRosClient:
    global _CLIENT
    with _CLIENT_LOCK:
        if _CLIENT is None:
            _CLIENT = PgearRosClient()
        return _CLIENT
