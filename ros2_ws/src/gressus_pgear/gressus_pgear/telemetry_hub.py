"""Thread-safe latest exoskeleton telemetry frame for WebSocket fanout."""

from __future__ import annotations

import threading
from typing import Any

from gressus_msgs.msg import PgearTelemetry

from gressus_pgear.ws_payload import disconnected_payload, msg_to_payload


class TelemetryHub:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._payload: dict[str, Any] = disconnected_payload()

    def update(self, msg: PgearTelemetry) -> None:
        with self._lock:
            self._payload = msg_to_payload(msg)

    def update_disconnected(self, *, error: str) -> None:
        with self._lock:
            self._payload = disconnected_payload(error=error)

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._payload)
