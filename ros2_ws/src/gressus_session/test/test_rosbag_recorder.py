"""Tests for rosbag subprocess recorder."""

from __future__ import annotations

from gressus_session.rosbag_recorder import RosbagRecorder, _record_command


def test_snapshot_idle_when_not_recording() -> None:
    recorder = RosbagRecorder()
    snap = recorder.snapshot()
    assert snap["state"] == "idle"
    assert snap["activeJob"] is None


def test_stop_when_idle_returns_false() -> None:
    recorder = RosbagRecorder()
    assert recorder.stop() is False


def test_default_command_records_all_ros_topics() -> None:
    assert _record_command("/tmp/session")[-1] == "-a"
