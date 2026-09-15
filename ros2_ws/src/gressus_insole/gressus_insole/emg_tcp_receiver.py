"""Validated binary EMG TCP receiver for the Windows WaveX bridge.

The stream deliberately transports full sample batches, not summary values.
Frame timestamps are assigned at Linux receipt time; hardware-clock alignment
with pressure is a later calibration concern.
"""

from __future__ import annotations

from dataclasses import dataclass
import queue
import socket
import struct
import threading
import time


_HEADER = struct.Struct("<4sBBHQIII")
_SENSOR_SLOT = struct.Struct("<H")
_FLOAT = struct.Struct("<f")
_MAGIC = b"GEMG"
_VERSION = 1
_MAX_CHANNELS = 36
_MAX_SAMPLES_PER_CHANNEL = 8192
_MAX_PAYLOAD_FLOATS = _MAX_CHANNELS * _MAX_SAMPLES_PER_CHANNEL


@dataclass(frozen=True)
class EmgFrame:
    """One complete WaveX acquisition batch.

    ``samples`` is channel-major: samples for ``sensor_slots[0]`` come first,
    followed by samples for ``sensor_slots[1]``, and so on.
    """

    frame_seq: int
    sample_rate_hz: int
    samples_per_channel: int
    sensor_slots: tuple[int, ...]
    samples: tuple[float, ...]
    received_monotonic: float


class EmgProtocolError(ValueError):
    """A peer sent an invalid or unsupported EMG frame."""


class EmgTcpReceiver:
    """Single-client EMG listener with bounded buffering and reconnect support."""

    def __init__(self, host: str, port: int, *, queue_size: int = 256) -> None:
        self.host = host
        self.port = port
        self._frames: queue.Queue[EmgFrame] = queue.Queue(maxsize=queue_size)
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._sock: socket.socket | None = None
        self._conn: socket.socket | None = None
        self._connected = False
        self._error: str | None = None
        self._dropped_frames = 0

    def start(self) -> None:
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        for sock in (self._conn, self._sock):
            if sock is None:
                continue
            try:
                sock.close()
            except OSError:
                pass
        if self._thread is not None:
            self._thread.join(timeout=1.0)

    def drain(self, limit: int = 64) -> list[EmgFrame]:
        """Return queued frames in order, capped to keep ROS callbacks bounded."""
        frames: list[EmgFrame] = []
        for _ in range(max(0, limit)):
            try:
                frames.append(self._frames.get_nowait())
            except queue.Empty:
                break
        return frames

    def status(self) -> tuple[bool, str | None, int]:
        with self._lock:
            return self._connected, self._error, self._dropped_frames

    def _run(self) -> None:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                self._sock = sock
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                sock.bind((self.host, self.port))
                sock.listen(1)
                sock.settimeout(0.5)
                while not self._stop.is_set():
                    try:
                        conn, _addr = sock.accept()
                    except TimeoutError:
                        continue
                    except OSError:
                        break
                    self._read_connection(conn)
        except OSError as exc:
            self._set_error(str(exc))
        finally:
            self._set_connected(False)
            self._sock = None

    def _read_connection(self, conn: socket.socket) -> None:
        self._conn = conn
        self._set_connected(True)
        self._set_error(None)
        try:
            conn.settimeout(0.5)
            with conn:
                while not self._stop.is_set():
                    try:
                        frame = self._read_frame(conn)
                    except TimeoutError:
                        continue
                    except (OSError, EmgProtocolError) as exc:
                        if not self._stop.is_set():
                            self._set_error(str(exc))
                        break
                    if frame is None:
                        break
                    self._put_frame(frame)
        finally:
            self._conn = None
            self._set_connected(False)

    def _read_frame(self, conn: socket.socket) -> EmgFrame | None:
        raw_header = self._read_exact(conn, _HEADER.size)
        if raw_header is None:
            return None
        magic, version, _reserved, channel_count, seq, rate_hz, scans, payload_floats = (
            _HEADER.unpack(raw_header)
        )
        if magic != _MAGIC or version != _VERSION:
            raise EmgProtocolError("unsupported EMG frame magic/version")
        if not 1 <= channel_count <= _MAX_CHANNELS:
            raise EmgProtocolError(f"invalid EMG channel count: {channel_count}")
        if not 1 <= scans <= _MAX_SAMPLES_PER_CHANNEL:
            raise EmgProtocolError(f"invalid EMG samples per channel: {scans}")
        expected_floats = channel_count * scans
        if payload_floats != expected_floats or payload_floats > _MAX_PAYLOAD_FLOATS:
            raise EmgProtocolError("invalid EMG payload length")

        raw_slots = self._read_exact(conn, channel_count * _SENSOR_SLOT.size)
        raw_samples = self._read_exact(conn, payload_floats * _FLOAT.size)
        if raw_slots is None or raw_samples is None:
            raise EmgProtocolError("truncated EMG frame")
        sensor_slots = struct.unpack(f"<{channel_count}H", raw_slots)
        if any(slot < 1 or slot > _MAX_CHANNELS for slot in sensor_slots):
            raise EmgProtocolError("invalid WaveX sensor slot")
        if len(set(sensor_slots)) != len(sensor_slots):
            raise EmgProtocolError("duplicate WaveX sensor slot")
        samples = struct.unpack(f"<{payload_floats}f", raw_samples)
        return EmgFrame(
            frame_seq=seq,
            sample_rate_hz=rate_hz,
            samples_per_channel=scans,
            sensor_slots=sensor_slots,
            samples=samples,
            received_monotonic=time.monotonic(),
        )

    @staticmethod
    def _read_exact(conn: socket.socket, size: int) -> bytes | None:
        chunks: list[bytes] = []
        remaining = size
        while remaining:
            chunk = conn.recv(remaining)
            if not chunk:
                if remaining == size:
                    return None
                raise EmgProtocolError("truncated EMG frame")
            chunks.append(chunk)
            remaining -= len(chunk)
        return b"".join(chunks)

    def _put_frame(self, frame: EmgFrame) -> None:
        try:
            self._frames.put_nowait(frame)
        except queue.Full:
            # Prefer the fresh acquisition data while making loss visible in
            # node diagnostics; the Windows sender also has a bounded queue.
            try:
                self._frames.get_nowait()
            except queue.Empty:
                pass
            try:
                self._frames.put_nowait(frame)
            except queue.Full:
                pass
            with self._lock:
                self._dropped_frames += 1

    def _set_connected(self, value: bool) -> None:
        with self._lock:
            self._connected = value

    def _set_error(self, value: str | None) -> None:
        with self._lock:
            self._error = value
