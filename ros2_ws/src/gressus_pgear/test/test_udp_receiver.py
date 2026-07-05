"""Tests for UDP telemetry receiver idle state."""

from __future__ import annotations

from gressus_pgear.udp_receiver import UdpTelemetryReceiver


def test_latest_snapshot_idle_before_packets() -> None:
    receiver = UdpTelemetryReceiver(udp_port=0)
    telemetry, _age_s, connected, error = receiver.latest_snapshot(0.5)
    assert telemetry is None
    assert connected is False
    assert error == "waiting for UDP telemetry broadcast"
