"""Tests for Telemetry -> PgearTelemetry mapping."""

from __future__ import annotations

import sys
from pathlib import Path

from gressus_pgear.telemetry_mapper import telemetry_to_msg


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def _ensure_pgear_pi() -> None:
    pi_gui = _repo_root() / "third_party" / "pgear_tools" / "pi_gui"
    if pi_gui.is_dir() and str(pi_gui) not in sys.path:
        sys.path.insert(0, str(pi_gui))


def test_telemetry_to_msg_connected() -> None:
    _ensure_pgear_pi()
    from pgear_pi.transport.esp32_link import Telemetry

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
        tcp_connected=True,
        telem_age_s=0.01,
        stale_after_s=0.5,
    )
    assert msg.connected is True
    assert msg.seq == 1
    assert msg.gait_phase == 2
    assert list(msg.pos) == [0.1, 0.2, 0.3, 0.4]
