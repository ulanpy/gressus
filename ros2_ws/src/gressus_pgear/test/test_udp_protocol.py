"""Tests for LogPacket decode."""

from __future__ import annotations

import struct

from gressus_pgear.udp_protocol import LOGPACKET_LEN, crc16_ccitt, decode_logpacket


def _build_logpacket(*, seq: int = 7, pos0: float = 1.25) -> bytes:
    buf = bytearray(LOGPACKET_LEN)
    buf[0] = 0xBB
    buf[1] = 0x66
    buf[2] = 3
    struct.pack_into("<H", buf, 4, seq)
    struct.pack_into("<I", buf, 8, 1234)
    struct.pack_into("<BBBB", buf, 12, 2, 5, 0, 0xFF)
    struct.pack_into("<HH", buf, 16, 0x0011, 12)
    struct.pack_into("<4f", buf, 36, pos0, 0.0, 0.0, 0.0)
    struct.pack_into("<H", buf, 204, crc16_ccitt(bytes(buf[:204])))
    return bytes(buf)


def test_decode_logpacket_roundtrip() -> None:
    packet = _build_logpacket(seq=42, pos0=3.5)
    telemetry = decode_logpacket(packet)
    assert telemetry is not None
    assert telemetry.seq == 42
    assert telemetry.gait_phase == 2
    assert telemetry.pos[0] == 3.5


def test_decode_logpacket_rejects_bad_crc() -> None:
    packet = bytearray(_build_logpacket())
    packet[205] ^= 0xFF
    assert decode_logpacket(bytes(packet)) is None
