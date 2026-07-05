"""Tests for runtime status assembly."""

from __future__ import annotations

from gressus_session.runtime_status import build_runtime_snapshot


def test_build_runtime_snapshot_idle_without_pgear_node() -> None:
    payload = build_runtime_snapshot(
        rosbag={"state": "idle", "activeJob": None, "lastExit": None},
        pgear={
            "nodeAvailable": False,
            "telemetryAvailable": False,
            "connected": False,
            "telemetryAgeS": None,
            "linkAgeMs": None,
            "error": "no telemetry publisher on /exoskeleton/telemetry",
        },
    )
    assert payload["state"] == "idle"
    assert payload["sessionManager"] == "up"
    assert payload["activeJob"] is None
    assert payload["pgear"]["nodeAvailable"] is False


def test_build_runtime_snapshot_recording_with_live_telemetry() -> None:
    payload = build_runtime_snapshot(
        rosbag={
            "state": "running",
            "activeJob": {
                "name": "rosbag:sess-1",
                "command": ["ros2", "bag", "record"],
                "pid": 1234,
                "uptimeS": 12.5,
            },
            "lastExit": None,
        },
        pgear={
            "nodeAvailable": True,
            "telemetryAvailable": True,
            "connected": True,
            "telemetryAgeS": 0.04,
            "linkAgeMs": 10,
            "error": None,
        },
    )
    assert payload["state"] == "running"
    assert payload["activeJob"]["pid"] == 1234
    assert payload["pgear"]["connected"] is True
    assert payload["pgear"]["telemetryAgeS"] == 0.04
