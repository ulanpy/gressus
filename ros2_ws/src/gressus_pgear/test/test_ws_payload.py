"""Tests for WebSocket JSON payload."""

from gressus_msgs.msg import PgearTelemetry
from gressus_pgear.ws_payload import disconnected_payload, msg_to_payload


def test_disconnected_payload_shape() -> None:
    payload = disconnected_payload(error="waiting")
    assert payload["connected"] is False
    assert payload["error"] == "waiting"
    assert len(payload["joints"]) == 4


def test_msg_to_payload_maps_gait_phase() -> None:
    msg = PgearTelemetry()
    msg.seq = 42
    msg.connected = True
    msg.error = ""
    msg.gait_phase = 2
    msg.step_idx = 7
    msg.sensor_health_mask = 15
    msg.flags = 1
    msg.link_age_ms = 12
    msg.controller_time_ms = 1000
    msg.amp_r = 0.5
    msg.amp_l = 0.4
    msg.assist_r = 0.5
    msg.assist_l = 0.5
    msg.ref_pos = [1.0, 2.0, 3.0, 4.0]
    msg.pos = [0.1, 0.2, 0.3, 0.4]
    msg.vel = [0.0, 0.0, 0.0, 0.0]
    msg.meas_torque = [0.0, 0.0, 0.0, 0.0]
    msg.iq_measured = [0.0, 0.0, 0.0, 0.0]

    payload = msg_to_payload(msg)
    assert payload["seq"] == 42
    assert payload["gaitPhaseName"] == "GAIT"
    assert payload["running"] is True
    assert payload["joints"][0]["name"] == "HR"
