"""Tests for Telemetry -> PgearTelemetry mapping."""

from __future__ import annotations

from gressus_pgear.telemetry_mapper import telemetry_to_msg
from gressus_pgear.udp_protocol import Telemetry


def test_telemetry_to_msg_connected() -> None:
    t = Telemetry(
        seq=1,
        time_ms=100,
        gait_phase=2,
        step_idx=3,
        flags=1,
        pos=(0.1, 0.2, 0.3, 0.4),
        vel=(1.0, 2.0, 3.0, 4.0),
        meas_torque=(0.5, 0.6, 0.7, 0.8),
    )
    msg = telemetry_to_msg(
        t,
        stamp=None,
        telem_age_s=0.01,
        stale_after_s=0.5,
    )
    assert msg.connected is True
    assert msg.seq == 1
    assert msg.gait_phase == 2
    assert list(msg.pos) == [0.1, 0.2, 0.3, 0.4]
