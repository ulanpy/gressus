"""Binary decode helpers for LogPacket_v2 (struct layout from docs/PACKET_STRUCTURE.md)."""

from __future__ import annotations

import struct
from typing import Final

from gressus_pgear.constants import LOG_PACKET_SIZE
from gressus_pgear.schemas import (
    DiagnosticsBlock,
    GaitState,
    JointArrays,
    JointFloats,
    JointHeartbeatAges,
    LogPacketFlags,
    LogPacketHeader,
    LogPacketTrailer,
    LogPacketV2,
    SensorHealth,
    TherapistTunables,
    TimingBlock,
)

_HEADER_FMT: Final = "<BBBBHH"
_TIMING_FMT: Final = "<I"
_GAIT_FMT: Final = "<BBBBHh"
_JOINT_FLOATS_FMT: Final = "<4f"
_HEARTBEAT_FMT: Final = "<4H"
_TUNABLES_FMT: Final = "<6f"
_DIAGNOSTICS_FMT: Final = "<HHHBB"
_TRAILER_FMT: Final = "<H"


def parse_log_packet_v2(data: bytes) -> LogPacketV2:
    """Decode a 206-byte LogPacket_v2 UDP payload into validated Pydantic models."""
    if len(data) < LOG_PACKET_SIZE:
        msg = f"expected at least {LOG_PACKET_SIZE} bytes, got {len(data)}"
        raise ValueError(msg)

    start0, start1, version, reserved0, seq, header_crc = struct.unpack_from(
        _HEADER_FMT, data, 0
    )
    time_ms, = struct.unpack_from(_TIMING_FMT, data, 8)
    gait_phase, step_idx, profile_slot, sensor_health_mask, flags_mask, link_age_ms = (
        struct.unpack_from(_GAIT_FMT, data, 12)
    )

    ref_pos = struct.unpack_from(_JOINT_FLOATS_FMT, data, 20)
    pos = struct.unpack_from(_JOINT_FLOATS_FMT, data, 36)
    vel = struct.unpack_from(_JOINT_FLOATS_FMT, data, 52)
    cmd_torque = struct.unpack_from(_JOINT_FLOATS_FMT, data, 68)
    meas_torque = struct.unpack_from(_JOINT_FLOATS_FMT, data, 84)
    grav_term = struct.unpack_from(_JOINT_FLOATS_FMT, data, 100)
    ff_term = struct.unpack_from(_JOINT_FLOATS_FMT, data, 116)
    iq_measured = struct.unpack_from(_JOINT_FLOATS_FMT, data, 132)
    motor_effort = struct.unpack_from(_JOINT_FLOATS_FMT, data, 148)
    hb_age_ms = struct.unpack_from(_HEARTBEAT_FMT, data, 164)

    assist_r, assist_l, deadzone_r, deadzone_l, amp_r, amp_l = struct.unpack_from(
        _TUNABLES_FMT, data, 172
    )
    ctrl_loop_us, link_crc_fails, link_resyncs, cross_check_fault, hb_error_byte = (
        struct.unpack_from(_DIAGNOSTICS_FMT, data, 196)
    )
    crc, = struct.unpack_from(_TRAILER_FMT, data, 204)

    return LogPacketV2(
        header=LogPacketHeader(
            start0=start0,
            start1=start1,
            version=version,
            reserved0=reserved0,
            seq=seq,
            header_crc=header_crc,
        ),
        timing=TimingBlock(time_ms=time_ms),
        gait=GaitState(
            gait_phase=gait_phase,
            step_idx=step_idx,
            profile_slot=profile_slot,
            sensor_health=SensorHealth.from_mask(sensor_health_mask),
            flags=LogPacketFlags.from_mask(flags_mask),
            link_age_ms=link_age_ms & 0xFFFF,
        ),
        joints=JointArrays(
            ref_pos=JointFloats.from_tuple(ref_pos),
            pos=JointFloats.from_tuple(pos),
            vel=JointFloats.from_tuple(vel),
            cmd_torque=JointFloats.from_tuple(cmd_torque),
            meas_torque=JointFloats.from_tuple(meas_torque),
            grav_term=JointFloats.from_tuple(grav_term),
            ff_term=JointFloats.from_tuple(ff_term),
            iq_measured=JointFloats.from_tuple(iq_measured),
            motor_effort=JointFloats.from_tuple(motor_effort),
            hb_age_ms=JointHeartbeatAges.from_tuple(hb_age_ms),
        ),
        tunables=TherapistTunables(
            assist_r=assist_r,
            assist_l=assist_l,
            deadzone_r=deadzone_r,
            deadzone_l=deadzone_l,
            amp_r=amp_r,
            amp_l=amp_l,
        ),
        diagnostics=DiagnosticsBlock(
            ctrl_loop_us=ctrl_loop_us,
            link_crc_fails=link_crc_fails,
            link_resyncs=link_resyncs,
            cross_check_fault=cross_check_fault,
            hb_error_byte=hb_error_byte,
        ),
        trailer=LogPacketTrailer(crc=crc),
    )
