"""Utilities for reading and summarising Insolex/WaveX JSONL pressure frames."""

from __future__ import annotations

import json
import socket
import threading
import time
from dataclasses import dataclass
from typing import Any

import numpy as np

N_SENSORS = 64


@dataclass(frozen=True)
class PressureStats:
    max_kpa: float = 0.0
    mean_kpa: float = 0.0
    sum_kpa: float = 0.0
    pressed: bool = False
    has_data: bool = False


@dataclass(frozen=True)
class InsoleSnapshot:
    obj: dict[str, Any]
    left: np.ndarray | None
    right: np.ndarray | None
    left_stats: PressureStats
    right_stats: PressureStats
    age_s: float | None
    connected: bool
    error: str | None

    @property
    def has_recent_data(self) -> bool:
        return self.age_s is not None


def latest_scan(obj: dict[str, Any]) -> tuple[np.ndarray | None, np.ndarray | None]:
    """Extract the latest L/R 64-sensor scan from a bridge JSON object."""
    return _one_latest_scan(obj.get("L")), _one_latest_scan(obj.get("R"))


def pressure_stats(values: np.ndarray | None, threshold_kpa: float) -> PressureStats:
    if values is None or values.size == 0:
        return PressureStats()
    clean = np.nan_to_num(values.astype(np.float64, copy=False), nan=0.0, posinf=0.0, neginf=0.0)
    if clean.size == 0:
        return PressureStats()
    max_kpa = float(np.max(clean))
    mean_kpa = float(np.mean(clean))
    sum_kpa = float(np.sum(clean))
    return PressureStats(
        max_kpa=max_kpa,
        mean_kpa=mean_kpa,
        sum_kpa=sum_kpa,
        pressed=max_kpa >= threshold_kpa,
        has_data=True,
    )


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


def _one_latest_scan(raw: Any) -> np.ndarray | None:
    if not isinstance(raw, list) or not raw:
        return None
    last = raw[-1]
    if not isinstance(last, list) or len(last) < N_SENSORS:
        return None
    return np.array(last[:N_SENSORS], dtype=np.float64)
