"""UDP broadcast listener for ESP32 LogPacket telemetry (no TCP command link)."""

from __future__ import annotations

import socket
import threading
import time

from gressus_pgear.udp_protocol import Telemetry, decode_logpacket

DEFAULT_UDP_PORT = 47000


class UdpTelemetryReceiver:
    """Background listener on UDP :47000; discovers ESP32 IP from packet source."""

    def __init__(self, *, udp_port: int = DEFAULT_UDP_PORT) -> None:
        self._udp_port = udp_port
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._udp: socket.socket | None = None
        self._rx_thread: threading.Thread | None = None
        self._latest: Telemetry | None = None
        self._telem_ts = 0.0
        self._source_host: str | None = None

    def start(self) -> None:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("", self._udp_port))
        sock.settimeout(0.5)
        self._udp = sock
        self._stop.clear()
        self._rx_thread = threading.Thread(target=self._rx_loop, name="pgear-udp", daemon=True)
        self._rx_thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._rx_thread is not None:
            self._rx_thread.join(timeout=1.0)
            self._rx_thread = None
        if self._udp is not None:
            try:
                self._udp.close()
            except OSError:
                pass
            self._udp = None

    def device_host(self) -> str | None:
        with self._lock:
            return self._source_host

    def telem_age_s(self) -> float:
        with self._lock:
            return time.monotonic() - self._telem_ts if self._telem_ts else 9999.0

    def latest_snapshot(
        self, stale_after_s: float
    ) -> tuple[Telemetry | None, float, bool, str | None]:
        with self._lock:
            telemetry = self._latest
            source = self._source_host
            age_s = time.monotonic() - self._telem_ts if self._telem_ts else 9999.0

        if telemetry is None:
            if source is None:
                return None, age_s, False, "waiting for UDP telemetry broadcast"
            return None, age_s, False, "waiting for first LogPacket"

        connected = age_s <= stale_after_s
        error = None if connected else f"stale telemetry (age={age_s:.2f}s)"
        return telemetry, age_s, connected, error

    def _rx_loop(self) -> None:
        assert self._udp is not None
        while not self._stop.is_set():
            try:
                data, addr = self._udp.recvfrom(512)
            except socket.timeout:
                continue
            except OSError:
                break

            telemetry = decode_logpacket(data)
            if telemetry is None:
                continue

            with self._lock:
                self._source_host = addr[0]
                self._latest = telemetry
                self._telem_ts = time.monotonic()
