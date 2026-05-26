"""WebSocket client for live insole frames consumed by station runners."""

from __future__ import annotations

import json
import os
import threading
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import numpy as np
from websockets.sync.client import connect

from shared.insole_types import InsoleSnapshot, PressureStats

DEFAULT_INSOLE_WS_BASE = os.environ.get("INSOLE_WS_URL", "ws://127.0.0.1:8000/ws/insole")


def build_insole_ws_url(
    base: str,
    *,
    threshold_kpa: float,
    size: str = "m",
    hz: float = 50.0,
) -> str:
    """Merge runtime query params into a `/ws/insole` URL."""
    parsed = urlparse(base)
    params = dict(parse_qsl(parsed.query, keep_blank_values=True))
    params.setdefault("size", size)
    params["threshold_kpa"] = f"{threshold_kpa:.3f}"
    params.setdefault("hz", str(hz))
    return urlunparse(parsed._replace(query=urlencode(params)))


def pressure_stats_from_payload(raw: object) -> PressureStats:
    if not isinstance(raw, dict):
        return PressureStats()
    return PressureStats(
        max_kpa=float(raw.get("maxKpa", 0.0) or 0.0),
        mean_kpa=float(raw.get("meanKpa", 0.0) or 0.0),
        sum_kpa=float(raw.get("sumKpa", 0.0) or 0.0),
        pressed=bool(raw.get("pressed", False)),
        has_data=bool(raw.get("hasData", False)),
    )


def snapshot_from_frame_payload(payload: dict[str, Any]) -> InsoleSnapshot:
    """Parse the JSON object shared by `/api/frame` and `/ws/insole`."""
    left = (
        np.array(payload["left"], dtype=np.float64)
        if isinstance(payload.get("left"), list)
        else None
    )
    right = (
        np.array(payload["right"], dtype=np.float64)
        if isinstance(payload.get("right"), list)
        else None
    )
    age_raw = payload.get("ageS")
    age_s = float(age_raw) if isinstance(age_raw, (int, float)) else None
    error = payload.get("error") if isinstance(payload.get("error"), str) else None
    return InsoleSnapshot(
        obj={"seq": payload.get("seq"), "dtMs": payload.get("dtMs")},
        left=left,
        right=right,
        left_stats=pressure_stats_from_payload(payload.get("leftStats")),
        right_stats=pressure_stats_from_payload(payload.get("rightStats")),
        age_s=age_s,
        connected=bool(payload.get("connected", False)),
        error=error,
    )


def _offline_snapshot(error: str | None = None) -> InsoleSnapshot:
    return InsoleSnapshot(
        obj={},
        left=None,
        right=None,
        left_stats=PressureStats(),
        right_stats=PressureStats(),
        age_s=None,
        connected=False,
        error=error,
    )


class InsoleWsClient:
    """Background consumer for `/ws/insole`; game loop reads the latest frame."""

    def __init__(self, ws_url: str) -> None:
        self._ws_url = ws_url
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._snapshot = _offline_snapshot("starting")

    def start(self) -> None:
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._run, name="insole-ws", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None

    def latest_snapshot(self) -> InsoleSnapshot:
        with self._lock:
            return self._snapshot

    def _set_snapshot(self, snapshot: InsoleSnapshot) -> None:
        with self._lock:
            self._snapshot = snapshot

    def _run(self) -> None:
        reconnect_delay = 0.5
        while not self._stop.is_set():
            try:
                with connect(self._ws_url, open_timeout=2.0, close_timeout=1.0) as ws:
                    reconnect_delay = 0.5
                    while not self._stop.is_set():
                        try:
                            raw = ws.recv(timeout=1.0)
                        except TimeoutError:
                            continue
                        payload = json.loads(raw)
                        if isinstance(payload, dict):
                            self._set_snapshot(snapshot_from_frame_payload(payload))
            except Exception as exc:
                self._set_snapshot(_offline_snapshot(str(exc)))
                if self._stop.wait(reconnect_delay):
                    return
                reconnect_delay = min(reconnect_delay * 1.5, 5.0)
