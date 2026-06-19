"""Map decoded LogPacket_v2 to gressus_msgs/PgearTelemetry."""

from __future__ import annotations

from gressus_msgs.msg import PgearTelemetry
from gressus_pgear.schemas import LogPacketV2


def _joint_floats(values) -> list[float]:
    return [float(x) for x in values.as_tuple()]


def _joint_ages(values) -> list[int]:
    return [int(x) & 0xFFFF for x in values.as_tuple()]


def packet_to_msg(packet: LogPacketV2, stamp, frame_id: str = "exoskeleton") -> PgearTelemetry:
    msg = PgearTelemetry()
    msg.header.stamp = stamp
    msg.header.frame_id = frame_id

    msg.seq = int(packet.seq)
    msg.controller_time_ms = int(packet.time_ms)
    msg.version = int(packet.version)

    gait = packet.gait
    msg.gait_phase = int(gait.gait_phase)
    msg.step_idx = int(gait.step_idx)
    msg.profile_slot = int(gait.profile_slot)
    msg.sensor_health_mask = int(gait.sensor_health.to_mask())
    msg.flags = int(gait.flags.to_mask())
    msg.link_age_ms = int(gait.link_age_ms)

    joints = packet.joints
    msg.ref_pos = _joint_floats(joints.ref_pos)
    msg.pos = _joint_floats(joints.pos)
    msg.vel = _joint_floats(joints.vel)
    msg.cmd_torque = _joint_floats(joints.cmd_torque)
    msg.meas_torque = _joint_floats(joints.meas_torque)
    msg.grav_term = _joint_floats(joints.grav_term)
    msg.ff_term = _joint_floats(joints.ff_term)
    msg.iq_measured = _joint_floats(joints.iq_measured)
    msg.motor_effort = _joint_floats(joints.motor_effort)
    msg.hb_age_ms = _joint_ages(joints.hb_age_ms)

    tun = packet.tunables
    msg.assist_r = float(tun.assist_r)
    msg.assist_l = float(tun.assist_l)
    msg.deadzone_r = float(tun.deadzone_r)
    msg.deadzone_l = float(tun.deadzone_l)
    msg.amp_r = float(tun.amp_r)
    msg.amp_l = float(tun.amp_l)

    diag = packet.diagnostics
    msg.ctrl_loop_us = int(diag.ctrl_loop_us)
    msg.link_crc_fails = int(diag.link_crc_fails)
    msg.link_resyncs = int(diag.link_resyncs)
    msg.cross_check_fault = int(diag.cross_check_fault)
    msg.hb_error_byte = int(diag.hb_error_byte)
    msg.packet_crc = int(packet.trailer.crc)

    msg.connected = True
    msg.error = ""
    return msg


def empty_msg(stamp, *, connected: bool, error: str, frame_id: str = "exoskeleton") -> PgearTelemetry:
    msg = PgearTelemetry()
    msg.header.stamp = stamp
    msg.header.frame_id = frame_id
    msg.connected = connected
    msg.error = error
    return msg
