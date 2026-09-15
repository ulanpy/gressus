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


def _default_insole_status(*, error: str | None = None) -> dict[str, Any]:
    return {
        "nodeAvailable": False,
        "connected": False,
        "error": error,
    }


def _default_emg_status(*, error: str | None = None) -> dict[str, Any]:
    return {
        "nodeAvailable": False,
        "connected": False,
        "error": error,
    }


def build_runtime_snapshot(
    *,
    rosbag: dict[str, Any],
    activity: dict[str, Any] | None = None,
    pgear: dict[str, Any] | None = None,
    insoles: dict[str, Any] | None = None,
    emg: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Merge rosbag process state with live device probes."""
    bag_state = rosbag.get("state", "idle")
    return {
        "state": bag_state if bag_state in ("idle", "running") else "idle",
        "activeJob": rosbag.get("activeJob"),
        "activity": activity or {"state": "idle", "activeJob": None},
        "pgear": pgear if pgear is not None else _default_pgear_status(),
        "insoles": insoles if insoles is not None else _default_insole_status(),
        "emg": emg if emg is not None else _default_emg_status(),
    }


def probe_pgear_status(probe: Any) -> dict[str, Any]:
    """Call ``device_status`` on the telemetry probe; never raise."""
    try:
        return probe.device_status()
    except Exception as exc:  # noqa: BLE001 — status endpoint must stay available
        return _default_pgear_status(error=str(exc))


def probe_insole_status(probe: Any) -> dict[str, Any]:
    """Call ``device_status`` on the pressure probe; never raise."""
    try:
        return probe.device_status()
    except Exception as exc:  # noqa: BLE001 — status endpoint must stay available
        return _default_insole_status(error=str(exc))


def probe_emg_status(probe: Any) -> dict[str, Any]:
    """Call ``device_status`` on the raw EMG probe; never raise."""
    try:
        return probe.device_status()
    except Exception as exc:  # noqa: BLE001 — status endpoint must stay available
        return _default_emg_status(error=str(exc))
