"""ESP32 LogPacket_v2 decode (UDP :47000).

Wire layout mirrors ``pgear_v8_firmware`` / ``protocol.h`` — keep in sync with
``third_party/pgear_tools/pi_gui/pgear_pi/transport/esp32_link.py`` without
importing that package.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass
from typing import Optional

LOG_MAGIC = (0xBB, 0x66)
LOGPACKET_LEN = 206


@dataclass
class Telemetry:
    """Decoded LogPacket subset for ROS publishing."""

    seq: int = 0
    time_ms: int = 0
    gait_phase: int = 0
    step_idx: int = 0
    sensor_health: int = 0
    flags: int = 0
    link_age_ms: int = 0
    ref_pos: tuple[float, ...] = ()
    pos: tuple[float, ...] = ()
    vel: tuple[float, ...] = ()
    cmd_torque: tuple[float, ...] = ()
    meas_torque: tuple[float, ...] = ()
    grav_term: tuple[float, ...] = ()
    ff_term: tuple[float, ...] = ()
    iq: tuple[float, ...] = ()
    motor_effort: tuple[float, ...] = ()
    assist_r: float = 0.0
    amp_r: float = 0.0
    amp_l: float = 0.0
    ctrl_loop_us: int = 0
    cross_check: int = 0
    hb_error: int = 0


def crc16_ccitt(data: bytes) -> int:
    crc = 0xFFFF
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if (crc & 0x8000) else (crc << 1) & 0xFFFF
    return crc


def decode_logpacket(data: bytes) -> Optional[Telemetry]:
    if len(data) < LOGPACKET_LEN or data[0] != LOG_MAGIC[0] or data[1] != LOG_MAGIC[1]:
        return None
    if data[2] != 3:
        return None
    if crc16_ccitt(data[:204]) != struct.unpack_from("<H", data, 204)[0]:
        return None
    t = Telemetry()
    t.seq = struct.unpack_from("<H", data, 4)[0]
    t.time_ms = struct.unpack_from("<I", data, 8)[0]
    t.gait_phase, t.step_idx, _slot, t.sensor_health = struct.unpack_from("<BBBB", data, 12)
    t.flags, t.link_age_ms = struct.unpack_from("<HH", data, 16)
    t.ref_pos = struct.unpack_from("<4f", data, 20)
    t.pos = struct.unpack_from("<4f", data, 36)
    t.vel = struct.unpack_from("<4f", data, 52)
    t.cmd_torque = struct.unpack_from("<4f", data, 68)
    t.meas_torque = struct.unpack_from("<4f", data, 84)
    t.grav_term = struct.unpack_from("<4f", data, 100)
    t.ff_term = struct.unpack_from("<4f", data, 116)
    t.iq = struct.unpack_from("<4f", data, 132)
    t.motor_effort = struct.unpack_from("<4f", data, 148)
    t.assist_r = struct.unpack_from("<f", data, 172)[0]
    t.amp_r, t.amp_l = struct.unpack_from("<2f", data, 188)
    t.ctrl_loop_us = struct.unpack_from("<H", data, 196)[0]
    t.cross_check, t.hb_error = struct.unpack_from("<BB", data, 202)
    return t
