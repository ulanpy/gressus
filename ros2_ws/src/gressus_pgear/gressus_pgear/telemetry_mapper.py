"""Map pgear_pi Esp32Link Telemetry to gressus_msgs/PgearTelemetry."""

from __future__ import annotations

from pgear_pi.transport.esp32_link import Telemetry

from gressus_msgs.msg import PgearTelemetry
from gressus_pgear.ros_msg import empty_msg


def _tuple4(values: tuple[float, ...] | None) -> list[float]:
    if not values:
        return [0.0, 0.0, 0.0, 0.0]
    out = [float(x) for x in values[:4]]
    while len(out) < 4:
        out.append(0.0)
    return out


def telemetry_to_msg(
    telemetry: Telemetry,
    stamp,
    *,
    frame_id: str = "exoskeleton",
    tcp_connected: bool,
    telem_age_s: float,
    stale_after_s: float,
) -> PgearTelemetry:
    fresh = telem_age_s <= stale_after_s
    if not fresh:
        return empty_msg(
            stamp,
            connected=False,
            error=f"stale telemetry (age={telem_age_s:.2f}s)",
            frame_id=frame_id,
        )

    msg = PgearTelemetry()
    msg.header.stamp = stamp
    msg.header.frame_id = frame_id

    msg.seq = int(telemetry.seq)
    msg.controller_time_ms = int(telemetry.time_ms)
    msg.version = 3

    msg.gait_phase = int(telemetry.gait_phase)
    msg.step_idx = int(telemetry.step_idx)
    msg.profile_slot = 0
    msg.sensor_health_mask = int(telemetry.sensor_health)
    msg.flags = int(telemetry.flags)
    msg.link_age_ms = int(telemetry.link_age_ms)

    msg.ref_pos = _tuple4(telemetry.ref_pos)
    msg.pos = _tuple4(telemetry.pos)
    msg.vel = _tuple4(telemetry.vel)
    msg.cmd_torque = _tuple4(telemetry.cmd_torque)
    msg.meas_torque = _tuple4(telemetry.meas_torque)
    msg.grav_term = _tuple4(telemetry.grav_term)
    msg.ff_term = _tuple4(telemetry.ff_term)
    msg.iq_measured = _tuple4(telemetry.iq)
    msg.motor_effort = _tuple4(telemetry.motor_effort)
    msg.hb_age_ms = [0, 0, 0, 0]

    msg.assist_r = float(telemetry.assist_r)
    msg.assist_l = float(telemetry.assist_r)
    msg.deadzone_r = 0.0
    msg.deadzone_l = 0.0
    msg.amp_r = float(telemetry.amp_r)
    msg.amp_l = float(telemetry.amp_l)

    msg.ctrl_loop_us = int(telemetry.ctrl_loop_us)
    msg.link_crc_fails = 0
    msg.link_resyncs = 0
    msg.cross_check_fault = int(telemetry.cross_check)
    msg.hb_error_byte = int(telemetry.hb_error)
    msg.packet_crc = 0

    msg.connected = tcp_connected or fresh
    if not tcp_connected:
        msg.error = "telemetry only (TCP command link not open yet)"
    else:
        msg.error = ""
    return msg
