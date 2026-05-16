"""FastAPI app for live/mock Insolex pressure visualisation."""

from __future__ import annotations

import asyncio
import os
import time
from contextlib import asynccontextmanager
from typing import Any, Literal

import numpy as np
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from src.insole_stream import InsoleTcpReceiver, N_SENSORS, pressure_stats

InsoleSize = Literal["m", "s"]
SourceMode = Literal["live", "mock"]

DEFAULT_HOST = os.environ.get("INSOLE_HOST", "0.0.0.0")
DEFAULT_PORT = int(os.environ.get("INSOLE_PORT", "9100"))
DEFAULT_THRESHOLD_KPA = 8.0


def load_insole_geometry(size: InsoleSize) -> tuple[
    tuple[tuple[float, float], ...],
    tuple[tuple[float, float], ...],
    float,
]:
    if size == "s":
        from src.insole_sensors_s import LEFT_MM, RIGHT_MM, SENSOR_SIDE_MM
    else:
        from src.insole_sensors_m import LEFT_MM, RIGHT_MM, SENSOR_SIDE_MM
    return LEFT_MM, RIGHT_MM, SENSOR_SIDE_MM


def mock_pressure_frame(
    coords_mm: tuple[tuple[float, float], ...],
    t_sec: float,
    *,
    phase_offset: float,
) -> np.ndarray:
    coords = np.array(coords_mm[:N_SENSORS], dtype=np.float64)
    ymin = float(np.min(coords[:, 1]))
    ymax = float(np.max(coords[:, 1]))
    length = max(ymax - ymin, 1e-6)
    x_center = float(np.mean(coords[:, 0]))

    step = (t_sec * 1.05 + phase_offset) % 1.0
    if step < 0.32:
        hotspot_y = ymin + length * (0.10 + step * 1.05)
        sigma_y = length * 0.13
        peak = 175.0
    elif step < 0.68:
        hotspot_y = ymin + length * (0.48 + (step - 0.32) * 0.55)
        sigma_y = length * 0.17
        peak = 255.0
    else:
        hotspot_y = ymin + length * (0.78 + (step - 0.68) * 0.55)
        sigma_y = length * 0.11
        peak = 145.0

    dy = coords[:, 1] - hotspot_y
    dx = coords[:, 0] - x_center
    sigma_x = length * 0.21
    dist2 = (dy / sigma_y) ** 2 + (dx / sigma_x) ** 2
    wobble = 1.0 + 0.06 * np.sin(t_sec * 9.0 + coords[:, 0] * 0.11 + coords[:, 1] * 0.07)
    return np.clip(peak * np.exp(-0.5 * dist2) * wobble, 0.0, None)


def _stats_payload(values: np.ndarray | None, threshold_kpa: float) -> dict[str, Any]:
    stats = pressure_stats(values, threshold_kpa)
    return {
        "maxKpa": stats.max_kpa,
        "meanKpa": stats.mean_kpa,
        "sumKpa": stats.sum_kpa,
        "pressed": stats.pressed,
        "hasData": stats.has_data,
    }


def _values_payload(values: np.ndarray | None) -> list[float] | None:
    if values is None:
        return None
    clean = np.nan_to_num(values[:N_SENSORS], nan=0.0, posinf=0.0, neginf=0.0)
    return [float(v) for v in clean]


def _mock_bridge_object(
    size: InsoleSize,
    t_sec: float,
    threshold_kpa: float,
) -> dict[str, Any]:
    left_mm, right_mm, _sensor_side_mm = load_insole_geometry(size)
    left = mock_pressure_frame(left_mm, t_sec, phase_offset=0.0)
    right = mock_pressure_frame(right_mm, t_sec, phase_offset=0.5)
    return _frame_payload(
        size=size,
        source="mock",
        obj={
            "seq": int(t_sec * 50),
            "dtMs": 20.0,
            "L_online": True,
            "R_online": True,
        },
        left=left,
        right=right,
        threshold_kpa=threshold_kpa,
        connected=True,
        age_s=0.0,
        error=None,
    )


def _frame_payload(
    *,
    size: InsoleSize,
    source: SourceMode,
    obj: dict[str, Any],
    left: np.ndarray | None,
    right: np.ndarray | None,
    threshold_kpa: float,
    connected: bool,
    age_s: float | None,
    error: str | None,
) -> dict[str, Any]:
    return {
        "size": size,
        "source": source,
        "seq": obj.get("seq"),
        "dtMs": obj.get("dtMs"),
        "connected": connected,
        "ageS": age_s,
        "error": error,
        "leftOnline": bool(obj.get("L_online", left is not None)),
        "rightOnline": bool(obj.get("R_online", right is not None)),
        "left": _values_payload(left),
        "right": _values_payload(right),
        "leftStats": _stats_payload(left, threshold_kpa),
        "rightStats": _stats_payload(right, threshold_kpa),
    }


def _live_frame_payload(size: InsoleSize, threshold_kpa: float) -> dict[str, Any]:
    snapshot = app.state.receiver.latest_snapshot(threshold_kpa)
    return _frame_payload(
        size=size,
        source="live",
        obj=snapshot.obj,
        left=snapshot.left,
        right=snapshot.right,
        threshold_kpa=threshold_kpa,
        connected=snapshot.connected,
        age_s=snapshot.age_s,
        error=snapshot.error,
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    receiver = InsoleTcpReceiver(DEFAULT_HOST, DEFAULT_PORT)
    _app.state.receiver = receiver
    _app.state.started_at = time.monotonic()
    receiver.start()
    try:
        yield
    finally:
        receiver.stop()


app = FastAPI(title="Insole pressure visualizer", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "insoleHost": DEFAULT_HOST, "insolePort": DEFAULT_PORT}


@app.get("/api/geometry")
def geometry(size: InsoleSize = Query("m")) -> dict[str, Any]:
    left_mm, right_mm, sensor_side_mm = load_insole_geometry(size)
    return {
        "size": size,
        "sensorSideMm": sensor_side_mm,
        "left": left_mm,
        "right": right_mm,
    }


@app.get("/api/frame")
def frame(
    size: InsoleSize = Query("m"),
    source: SourceMode = Query("live"),
    threshold_kpa: float = Query(DEFAULT_THRESHOLD_KPA, ge=0),
) -> dict[str, Any]:
    if source == "mock":
        return _mock_bridge_object(size, time.monotonic() - app.state.started_at, threshold_kpa)
    return _live_frame_payload(size, threshold_kpa)


@app.websocket("/ws/insole")
async def insole_ws(
    websocket: WebSocket,
    size: InsoleSize = Query("m"),
    source: SourceMode = Query("live"),
    threshold_kpa: float = Query(DEFAULT_THRESHOLD_KPA, ge=0),
    hz: float = Query(50.0, ge=1.0, le=60.0),
) -> None:
    await websocket.accept()
    delay = 1.0 / hz
    try:
        while True:
            if source == "mock":
                payload = _mock_bridge_object(size, time.monotonic() - app.state.started_at, threshold_kpa)
            else:
                payload = _live_frame_payload(size, threshold_kpa)
            await websocket.send_json(payload)
            await asyncio.sleep(delay)
    except WebSocketDisconnect:
        return
    except RuntimeError:
        return
