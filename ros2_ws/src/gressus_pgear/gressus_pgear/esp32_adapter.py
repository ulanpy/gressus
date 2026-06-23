"""Thin wrapper around pgear_pi Esp32Link for Gressus ROS nodes."""

from __future__ import annotations

import json
import threading
from typing import Any

from gressus_pgear.profile_loader import apply_profile


class Esp32Adapter:
    def __init__(self, esp_host: str | None = None) -> None:
        from pgear_pi.transport.esp32_link import Esp32Link

        self._link = Esp32Link(host=esp_host or None)
        self._lock = threading.Lock()
        self._latest: Any | None = None
        self._link.on_telemetry = self._on_telemetry

    def _on_telemetry(self, telemetry) -> None:
        with self._lock:
            self._latest = telemetry

    def start(self) -> None:
        self._link.start()

    def stop(self) -> None:
        self._link.stop()

    def latest_snapshot(self, stale_after_s: float) -> tuple[Any | None, float, bool, str | None]:
        with self._lock:
            telemetry = self._latest
        if telemetry is None:
            host = self._link.host()
            if host is None:
                return None, 9999.0, False, "waiting for UDP telemetry (auto-discover ESP32 IP)"
            return None, self._link.telem_age_s(), False, "waiting for first LogPacket"

        age_s = self._link.telem_age_s()
        connected = age_s <= stale_after_s
        error = None if connected else f"stale telemetry (age={age_s:.2f}s)"
        return telemetry, age_s, connected, error

    def tcp_connected(self) -> bool:
        return self._link.connected()

    def device_host(self) -> str | None:
        return self._link.host()

    def estop(self) -> bool:
        return bool(self._link.estop())

    def estop_reset(self) -> bool:
        return bool(self._link.estop_reset())

    def arm(self) -> bool:
        return bool(self._link.arm())

    def disarm(self) -> bool:
        return bool(self._link.disarm())

    def run(self) -> bool:
        return bool(self._link.run())

    def stop_gait(self) -> bool:
        return bool(self._link.stop_gait())

    def load_profile_dict(self, profile: dict[str, Any]) -> None:
        apply_profile(self._link, profile)

    def load_profile_json(self, profile_json: str) -> dict[str, Any]:
        profile = json.loads(profile_json)
        if not isinstance(profile, dict):
            raise ValueError("profile JSON must be an object")
        wrapped = profile.get("profile", profile)
        if not isinstance(wrapped, dict):
            raise ValueError("profile field must be an object")
        self.load_profile_dict(wrapped)
        return wrapped
