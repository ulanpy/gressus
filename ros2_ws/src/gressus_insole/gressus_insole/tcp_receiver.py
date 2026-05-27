"""TCP JSONL receiver for the Windows WaveX insole bridge."""

from __future__ import annotations

import json
import socket
import threading
import time
from typing import Any

from gressus_common.insole_types import InsoleSnapshot, latest_scan, pressure_stats


class InsoleTcpReceiver:
    """Small single-client TCP JSONL receiver for the Windows WaveX bridge."""

    def __init__(self, host: str, port: int) -> None:
        self.host = host
        self.port = port
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._latest_obj: dict[str, Any] = {}
        self._latest_t: float | None = None
        self._connected = False
        self._error: str | None = None
        self._sock: socket.socket | None = None
        self._conn: socket.socket | None = None

    def start(self) -> None:
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        for s in (self._conn, self._sock):
            if s is None:
                continue
            try:
                s.close()
            except OSError:
                pass
        if self._thread is not None:
            self._thread.join(timeout=1.0)

    def latest_snapshot(self, threshold_kpa: float) -> InsoleSnapshot:
        with self._lock:
            obj = dict(self._latest_obj)
            latest_t = self._latest_t
            connected = self._connected
            error = self._error
        left, right = latest_scan(obj)
        age_s = None if latest_t is None else max(0.0, time.monotonic() - latest_t)
        return InsoleSnapshot(
            obj=obj,
            left=left,
            right=right,
            left_stats=pressure_stats(left, threshold_kpa),
            right_stats=pressure_stats(right, threshold_kpa),
            age_s=age_s,
            connected=connected,
            error=error,
        )

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
        except OSError as e:
            self._set_error(str(e))
        finally:
            self._set_connected(False)
            self._sock = None

    def _read_connection(self, conn: socket.socket) -> None:
        self._conn = conn
        self._set_connected(True)
        self._set_error(None)
        buf = b""
        try:
            conn.settimeout(0.5)
            with conn:
                while not self._stop.is_set():
                    try:
                        chunk = conn.recv(65536)
                    except TimeoutError:
                        continue
                    except OSError:
                        break
                    if not chunk:
                        break
                    buf += chunk
                    while b"\n" in buf:
                        raw, buf = buf.split(b"\n", 1)
                        self._handle_line(raw.decode("utf-8", errors="replace").strip())
        finally:
            self._conn = None
            self._set_connected(False)

    def _handle_line(self, line: str) -> None:
        if not line or line.startswith("#"):
            return
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            return
        if not isinstance(obj, dict):
            return
        with self._lock:
            self._latest_obj = obj
            self._latest_t = time.monotonic()
            self._error = None

    def _set_connected(self, value: bool) -> None:
        with self._lock:
            self._connected = value

    def _set_error(self, value: str | None) -> None:
        with self._lock:
            self._error = value
