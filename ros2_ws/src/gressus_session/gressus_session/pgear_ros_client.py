"""Subscribe to ``/exoskeleton/telemetry`` for session_manager status probes."""

from __future__ import annotations

import threading
import time
from typing import Any

import rclpy
from gressus_msgs.msg import PgearTelemetry
from rclpy.node import Node

_TELEMETRY_TOPIC = "/exoskeleton/telemetry"


class PgearTelemetryProbe:
    """Read latest telemetry topic samples (no device control)."""

    def __init__(self) -> None:
        if not rclpy.ok():
            rclpy.init()
        self._node = rclpy.create_node("gressus_session_pgear_probe")
        self._lock = threading.Lock()

    def device_status(self, *, telem_timeout_s: float = 0.5) -> dict[str, Any]:
        node_available = bool(self._node.get_publishers_info_by_topic(_TELEMETRY_TOPIC))

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

        msg = holder.get("msg")
        if msg is None:
            error = "no telemetry yet" if node_available else "telemetry publisher not running"
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


_PROBE: PgearTelemetryProbe | None = None
_PROBE_LOCK = threading.Lock()


def get_pgear_probe() -> PgearTelemetryProbe:
    global _PROBE
    with _PROBE_LOCK:
        if _PROBE is None:
            _PROBE = PgearTelemetryProbe()
        return _PROBE
