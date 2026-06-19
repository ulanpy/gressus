"""UDP broadcast receiver for P.GEAR LogPacket_v2 (port 47000)."""

from __future__ import annotations

import socket
import threading
import time
from dataclasses import dataclass

from gressus_pgear.codec import parse_log_packet_v2
from gressus_pgear.constants import LOG_PACKET_SIZE, UDP_BROADCAST_PORT
from gressus_pgear.schemas import LogPacketV2


@dataclass(frozen=True)
class PgearSnapshot:
    packet: LogPacketV2 | None
    age_s: float | None
    connected: bool
    error: str | None
    packets_received: int
    parse_errors: int


class PgearUdpReceiver:
    """Background thread: bind UDP port and keep the latest decoded LogPacket_v2."""

    def __init__(self, host: str, port: int) -> None:
        self._host = host
        self._port = port
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._latest: LogPacketV2 | None = None
        self._latest_t: float | None = None
        self._connected = False
        self._error: str | None = None
        self._packets_received = 0
        self._parse_errors = 0
        self._sock: socket.socket | None = None

    def start(self) -> None:
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._sock is not None:
            try:
                self._sock.close()
            except OSError:
                pass
        if self._thread is not None:
            self._thread.join(timeout=1.0)

    def latest_snapshot(self, stale_after_s: float = 0.5) -> PgearSnapshot:
        with self._lock:
            latest = self._latest
            latest_t = self._latest_t
            connected = self._connected
            error = self._error
            packets = self._packets_received
            parse_errors = self._parse_errors

        age_s = None if latest_t is None else max(0.0, time.monotonic() - latest_t)
        live = (
            connected
            and latest is not None
            and age_s is not None
            and age_s <= stale_after_s
        )
        return PgearSnapshot(
            packet=latest,
            age_s=age_s,
            connected=live,
            error=error,
            packets_received=packets,
            parse_errors=parse_errors,
        )

    def _run(self) -> None:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                self._sock = sock
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                sock.bind((self._host, self._port))
                sock.settimeout(0.5)
                with self._lock:
                    self._connected = True
                    self._error = None
                while not self._stop.is_set():
                    try:
                        data, _addr = sock.recvfrom(LOG_PACKET_SIZE + 64)
                    except TimeoutError:
                        continue
                    except OSError:
                        break
                    self._handle_packet(data)
        except OSError as exc:
            with self._lock:
                self._connected = False
                self._error = str(exc)
        finally:
            with self._lock:
                self._connected = False

    def _handle_packet(self, data: bytes) -> None:
        try:
            packet = parse_log_packet_v2(data)
        except ValueError as exc:
            with self._lock:
                self._parse_errors += 1
                self._error = str(exc)
            return

        with self._lock:
            self._latest = packet
            self._latest_t = time.monotonic()
            self._packets_received += 1
            self._error = None
