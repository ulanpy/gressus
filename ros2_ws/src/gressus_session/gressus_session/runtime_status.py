"""Assemble ``GET /session/status`` runtime payload from live probes."""

from __future__ import annotations

from typing import Any


def _default_pgear_status(*, error: str | None = None) -> dict[str, Any]:
    return {
        "nodeAvailable": False,
        "telemetryAvailable": False,
        "connected": False,
        "telemetryAgeS": None,
        "linkAgeMs": None,
        "error": error,
    }


def build_runtime_snapshot(*, rosbag: dict[str, Any], pgear: dict[str, Any] | None = None) -> dict[str, Any]:
    """Merge rosbag process state with P.GEAR device probes."""
    bag_state = rosbag.get("state", "idle")
    return {
        "state": bag_state if bag_state in ("idle", "running") else "idle",
        "activeJob": rosbag.get("activeJob"),
        "pgear": pgear if pgear is not None else _default_pgear_status(),
    }


def probe_pgear_status(probe: Any) -> dict[str, Any]:
    """Call ``device_status`` on the telemetry probe; never raise."""
    try:
        return probe.device_status()
    except Exception as exc:  # noqa: BLE001 — status endpoint must stay available
        return _default_pgear_status(error=str(exc))
