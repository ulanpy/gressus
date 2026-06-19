"""Tests for LogPacket_v2 codec."""

from __future__ import annotations

import struct

from gressus_pgear.codec import parse_log_packet_v2
from gressus_pgear.constants import LOG_PACKET_MAGIC, LOG_PACKET_SIZE


def _minimal_packet() -> bytes:
    buf = bytearray(LOG_PACKET_SIZE)
    buf[0], buf[1], buf[2] = LOG_PACKET_MAGIC[0], LOG_PACKET_MAGIC[1], 3
    struct.pack_into("<H", buf, 4, 42)
    struct.pack_into("<I", buf, 8, 123456)
    struct.pack_into("<BBBBHh", buf, 12, 0, 1, 0xFF, 0x0F, 0x0001, 10)
    for offset in (20, 36, 52, 68, 84, 100, 116, 132, 148):
        struct.pack_into("<4f", buf, offset, 0.1, 0.2, 0.3, 0.4)
    struct.pack_into("<4H", buf, 164, 1, 2, 3, 4)
    struct.pack_into("<6f", buf, 172, 0.5, 0.5, 0.01, 0.01, 0.2, 0.2)
    struct.pack_into("<HHHBB", buf, 196, 4000, 0, 0, 0, 0)
    struct.pack_into("<H", buf, 204, 0xBEEF)
    return bytes(buf)


def test_parse_log_packet_v2_roundtrip_fields() -> None:
    packet = parse_log_packet_v2(_minimal_packet())
    assert packet.seq == 42
    assert packet.time_ms == 123456
    assert packet.gait.step_idx == 1
    assert packet.gait.profile_slot == 0xFF
    assert packet.joints.pos.r_hip == 0.1
    assert packet.tunables.assist_r == 0.5
    assert packet.trailer.crc == 0xBEEF
