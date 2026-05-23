"""FastAPI app for live/mock Insolex pressure visualisation."""

from __future__ import annotations

import asyncio
import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal

import numpy as np
from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.insole_stream import InsoleTcpReceiver, N_SENSORS, pressure_stats
from src.runtime.process_manager import ProcessManager

InsoleSize = Literal["m", "s"]
SourceMode = Literal["live", "mock"]

DEFAULT_HOST = os.environ.get("INSOLE_HOST", "0.0.0.0")
DEFAULT_PORT = int(os.environ.get("INSOLE_PORT", "9100"))
DEFAULT_THRESHOLD_KPA = 8.0
DEFAULT_CALIBRATION_PATH = "config/calibration.json"
DEFAULT_LOOPBACK_BASE = os.environ.get("RUNTIME_LOOPBACK_BASE_URL", "http://127.0.0.1:8000")
REPO_ROOT = Path(__file__).resolve().parent.parent


class StartRuntimeRequest(BaseModel):
    job: Literal["game", "calibrate_apriltag"]
    display: int | None = None
    outputRotation: Literal[0, 90, 180, 270] = 270
    insoleThresholdKpa: float = Field(DEFAULT_THRESHOLD_KPA, ge=0.0)
    noInsole: bool = False
    demo: bool = False
    speed: float = Field(0.35, ge=0.05, le=1.5)
    stepTimeS: float = Field(2.5, ge=0.2, le=2.8)


class StopRuntimeRequest(BaseModel):
    timeoutS: float = Field(3.0, ge=0.5, le=15.0)


def _manager_payload() -> dict[str, Any]:
    return app.state.process_manager.snapshot()


def _command_for_job(cfg: StartRuntimeRequest) -> list[str]:
    python_bin = sys.executable
    if cfg.job == "game":
        cmd = [
            python_bin,
            "scripts/tile_game.py",
            "--calibration",
            DEFAULT_CALIBRATION_PATH,
            "--output-rotation",
            str(cfg.outputRotation),
            "--insole-thresh-kpa",
            str(cfg.insoleThresholdKpa),
            "--speed",
            str(cfg.speed),
            "--step-time-s",
            str(cfg.stepTimeS),
            "--insole-frame-url",
            f"{DEFAULT_LOOPBACK_BASE}/api/frame?source=live",
        ]
        if cfg.demo:
            cmd.append("--demo")
        if cfg.noInsole or cfg.demo:
            cmd.append("--no-insole")
        if cfg.display is not None:
            cmd.extend(["-d", str(cfg.display)])
        return cmd

    return [
        python_bin,
        "scripts/calibrate_apriltag.py",
        "-c",
        "realsense",
        "--width",
        "640",
        "--height",
        "480",
        "--fps",
        "30",
        "--display",
        "0",
        "--tag-size",
        "280",
        "--margin",
        "30",
        "-o",
        DEFAULT_CALIBRATION_PATH,
    ]


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
    available: bool = True,
    game_running: bool = False,
) -> dict[str, Any]:
    return {
        "size": size,
        "source": source,
        "available": available,
        "gameRunning": game_running,
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


def _passive_live_payload(size: InsoleSize) -> dict[str, Any]:
    return _frame_payload(
        size=size,
        source="live",
        obj={},
        left=None,
        right=None,
        threshold_kpa=0.0,
        connected=False,
        age_s=None,
        error=None,
        available=False,
        game_running=False,
    )


def _is_game_running() -> bool:
    snap = app.state.process_manager.snapshot()
    active = snap.get("activeJob") or {}
    return active.get("name") == "game"


def _ensure_receiver_lifecycle() -> bool:
    """Bind the insole TCP listener only while a game subprocess is running."""
    game_running = _is_game_running()
    receiver: InsoleTcpReceiver | None = getattr(app.state, "receiver", None)
    if game_running and receiver is None:
        receiver = InsoleTcpReceiver(DEFAULT_HOST, DEFAULT_PORT)
        receiver.start()
        app.state.receiver = receiver
        return True
    if not game_running and receiver is not None:
        receiver.stop()
        app.state.receiver = None
        return False
    return receiver is not None


def _live_frame_payload(size: InsoleSize, threshold_kpa: float) -> dict[str, Any]:
    active = _ensure_receiver_lifecycle()
    receiver: InsoleTcpReceiver | None = getattr(app.state, "receiver", None)
    if not active or receiver is None:
        return _passive_live_payload(size)
    snapshot = receiver.latest_snapshot(threshold_kpa)
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
        available=True,
        game_running=True,
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    process_manager = ProcessManager(cwd=REPO_ROOT)
    _app.state.receiver = None
    _app.state.process_manager = process_manager
    _app.state.started_at = time.monotonic()
    try:
        yield
    finally:
        process_manager.shutdown()
        existing: InsoleTcpReceiver | None = getattr(_app.state, "receiver", None)
        if existing is not None:
            existing.stop()
            _app.state.receiver = None


app = FastAPI(title="Insole pressure visualizer", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "insoleHost": DEFAULT_HOST,
        "insolePort": DEFAULT_PORT,
        "runtime": _manager_payload(),
    }


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


@app.get("/api/runtime/status")
def runtime_status() -> dict[str, Any]:
    _ensure_receiver_lifecycle()
    return _manager_payload()


@app.post("/api/runtime/start")
def runtime_start(payload: StartRuntimeRequest, request: Request) -> dict[str, Any]:
    _ = request  # keeps API stable if later needed for request-derived config
    cmd = _command_for_job(payload)
    manager = app.state.process_manager
    try:
        job = manager.start(
            name=payload.job,
            command=cmd,
            env={"QT_QPA_PLATFORM": os.environ.get("QT_QPA_PLATFORM", "xcb")},
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    still_alive = manager.wait_briefly(0.3)
    if not still_alive:
        tail = manager.tail_log(max_bytes=4096)
        snapshot = _manager_payload()
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"{payload.job} exited immediately",
                "logPath": str(job.log_path),
                "logTail": tail,
                "runtime": snapshot,
            },
        )

    _ensure_receiver_lifecycle()
    return {
        "ok": True,
        "started": {
            "name": job.name,
            "pid": job.pid,
            "command": list(job.command),
            "logPath": str(job.log_path),
        },
        "runtime": _manager_payload(),
    }


@app.post("/api/runtime/stop")
def runtime_stop(payload: StopRuntimeRequest) -> dict[str, Any]:
    stopped = app.state.process_manager.stop(timeout_s=payload.timeoutS)
    _ensure_receiver_lifecycle()
    return {"ok": True, "stopped": stopped, "runtime": _manager_payload()}


@app.get("/api/runtime/log")
def runtime_log(tail: int = Query(4096, ge=128, le=65536)) -> dict[str, Any]:
    manager = app.state.process_manager
    snapshot = manager.snapshot()
    active = snapshot.get("activeJob") or {}
    log_path = active.get("logPath")
    if log_path is None:
        last_exit = snapshot.get("lastExit") or {}
        log_path = last_exit.get("logPath")
    return {
        "logPath": log_path,
        "logTail": manager.tail_log(max_bytes=tail),
    }


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
