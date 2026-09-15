"""Protocol-level tests for raw EMG transport."""

import struct

import pytest

from gressus_insole.emg_tcp_receiver import EmgProtocolError, EmgTcpReceiver


class _ChunkedConnection:
    def __init__(self, payload: bytes, chunk_size: int = 5) -> None:
        self._payload = payload
        self._chunk_size = chunk_size

    def recv(self, requested: int) -> bytes:
        if not self._payload:
            return b""
        size = min(requested, self._chunk_size)
        chunk, self._payload = self._payload[:size], self._payload[size:]
        return chunk


def test_decodes_all_samples_in_channel_major_frame() -> None:
    payload = struct.pack(
        "<4sBBHQIII2H6f",
        b"GEMG",
        1,
        0,
        2,
        42,
        2000,
        3,
        6,
        1,
        4,
        1.0,
        2.0,
        3.0,
        4.0,
        5.0,
        6.0,
    )

    frame = EmgTcpReceiver("127.0.0.1", 9101)._read_frame(
        _ChunkedConnection(payload)
    )

    assert frame is not None
    assert frame.frame_seq == 42
    assert frame.sample_rate_hz == 2000
    assert frame.samples_per_channel == 3
    assert frame.sensor_slots == (1, 4)
    assert frame.samples == (1.0, 2.0, 3.0, 4.0, 5.0, 6.0)


def test_rejects_mismatched_payload_length() -> None:
    payload = struct.pack(
        "<4sBBHQIII",
        b"GEMG",
        1,
        0,
        1,
        1,
        2000,
        100,
        99,
    )

    with pytest.raises(EmgProtocolError, match="payload length"):
        EmgTcpReceiver("127.0.0.1", 9101)._read_frame(_ChunkedConnection(payload))
