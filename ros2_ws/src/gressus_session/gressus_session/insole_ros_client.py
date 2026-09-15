"""Subscribe to ``/insole/pressure`` for session-manager status probes."""

from __future__ import annotations

import threading
import time
from typing import Any

import rclpy
from gressus_msgs.msg import InsolePressure

_PRESSURE_TOPIC = "/insole/pressure"


class InsolePressureProbe:
    """Read the latest insole frame without owning the insole connection."""

    def __init__(self) -> None:
        if not rclpy.ok():
            rclpy.init()
        self._node = rclpy.create_node("gressus_session_insole_probe")
        self._lock = threading.Lock()

    def device_status(self, *, frame_timeout_s: float = 0.5) -> dict[str, Any]:
        node_available = bool(self._node.get_publishers_info_by_topic(_PRESSURE_TOPIC))
        holder: dict[str, InsolePressure] = {}

        with self._lock:
            subscription = self._node.create_subscription(
                InsolePressure,
                _PRESSURE_TOPIC,
                lambda message: holder.__setitem__("message", message),
                10,
            )
            try:
                deadline = time.monotonic() + frame_timeout_s
                while "message" not in holder and time.monotonic() < deadline:
                    rclpy.spin_once(self._node, timeout_sec=0.1)
            finally:
                self._node.destroy_subscription(subscription)

        message = holder.get("message")
        if message is None:
            return {
                "nodeAvailable": node_available,
                "connected": False,
                "error": "pressure publisher not running" if not node_available else "no pressure frame yet",
            }

        error = str(message.error).strip() or None
        return {
            "nodeAvailable": node_available,
            "connected": bool(message.connected),
            "error": error,
        }


_PROBE: InsolePressureProbe | None = None
_PROBE_LOCK = threading.Lock()


def get_insole_probe() -> InsolePressureProbe:
    global _PROBE
    with _PROBE_LOCK:
        if _PROBE is None:
            _PROBE = InsolePressureProbe()
        return _PROBE
