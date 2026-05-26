"""Runtime data feeds for tile_game (local hardware or ROS topics)."""

from __future__ import annotations

import threading
from collections import deque
from dataclasses import dataclass
from typing import Protocol

import cv2
import numpy as np

from shared.insole_types import InsoleSnapshot, N_SENSORS, pressure_stats
from station.lib.game.realsense_depth import capture_floor_and_color, start_realsense


class InsoleFeed(Protocol):
    def latest(self, threshold_kpa: float) -> InsoleSnapshot | None: ...

    def close(self) -> None: ...


class CameraFeed(Protocol):
    depth_scale_m: float

    def latest(self) -> tuple[np.ndarray | None, np.ndarray | None]: ...

    def capture_floor(self, n: int) -> tuple[np.ndarray | None, np.ndarray | None]: ...

    def close(self) -> None: ...


class NullInsoleFeed:
    def latest(self, threshold_kpa: float) -> InsoleSnapshot | None:
        return None

    def close(self) -> None:
        return None


class LocalWsInsoleFeed:
    def __init__(self, ws_url: str) -> None:
        from station.lib.insole_ws_client import InsoleWsClient

        self._client = InsoleWsClient(ws_url)
        self._client.start()

    def latest(self, threshold_kpa: float) -> InsoleSnapshot | None:
        snap = self._client.latest_snapshot()
        if snap.left is None and snap.right is None:
            return snap
        return InsoleSnapshot(
            obj=snap.obj,
            left=snap.left,
            right=snap.right,
            left_stats=pressure_stats(snap.left, threshold_kpa),
            right_stats=pressure_stats(snap.right, threshold_kpa),
            age_s=snap.age_s,
            connected=snap.connected,
            error=snap.error,
        )

    def close(self) -> None:
        self._client.stop()


class LocalRealSenseFeed:
    def __init__(self) -> None:
        import pyrealsense2 as rs

        self._pipe, self._align, self.depth_scale_m = start_realsense(
            rs,
            depth_width=640,
            depth_height=480,
            depth_fps=15,
            color_width=640,
            color_height=480,
            color_fps=15,
        )

    def latest(self) -> tuple[np.ndarray | None, np.ndarray | None]:
        try:
            frames = self._pipe.wait_for_frames(timeout_ms=5000)
        except RuntimeError:
            return None, None
        frames = self._align.process(frames)
        depth_mm, color_gray = None, None
        depth_frame = frames.get_depth_frame()
        color_frame = frames.get_color_frame()
        if depth_frame:
            depth_mm = (
                np.asanyarray(depth_frame.get_data()).astype(np.float32)
                * self.depth_scale_m
                * 1000.0
            )
        if color_frame:
            color_gray = cv2.cvtColor(
                np.asanyarray(color_frame.get_data()), cv2.COLOR_BGR2GRAY
            )
        return depth_mm, color_gray

    def capture_floor(self, n: int) -> tuple[np.ndarray | None, np.ndarray | None]:
        return capture_floor_and_color(self._pipe, self._align, self.depth_scale_m, n)

    def close(self) -> None:
        try:
            self._pipe.stop()
        except Exception:
            pass


@dataclass
class _FramePair:
    depth_mm: np.ndarray
    color_gray: np.ndarray


class RosInsoleFeed:
    """Thread-safe cache updated from an InsolePressure subscription."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._snapshot: InsoleSnapshot | None = None

    def update_from_msg(self, msg) -> None:
        left = np.array(list(msg.left[:N_SENSORS]), dtype=np.float64)
        right = np.array(list(msg.right[:N_SENSORS]), dtype=np.float64)
        age_s = float(msg.age_s) if msg.age_s >= 0.0 else None
        snap = InsoleSnapshot(
            obj={"seq": msg.header.stamp.sec},
            left=left,
            right=right,
            left_stats=pressure_stats(left, 0.0),
            right_stats=pressure_stats(right, 0.0),
            age_s=age_s,
            connected=bool(msg.connected),
            error=msg.error or None,
        )
        with self._lock:
            self._snapshot = snap

    def latest(self, threshold_kpa: float) -> InsoleSnapshot | None:
        with self._lock:
            snap = self._snapshot
        if snap is None:
            return None
        return InsoleSnapshot(
            obj=snap.obj,
            left=snap.left,
            right=snap.right,
            left_stats=pressure_stats(snap.left, threshold_kpa),
            right_stats=pressure_stats(snap.right, threshold_kpa),
            age_s=snap.age_s,
            connected=snap.connected,
            error=snap.error,
        )

    def close(self) -> None:
        return None


class RosCameraFeed:
    """Thread-safe cache of aligned depth/color frames from ROS image topics."""

    def __init__(self, *, depth_scale_m: float = 0.001, floor_buffer: int = 30) -> None:
        self.depth_scale_m = depth_scale_m
        self._lock = threading.Lock()
        self._depth_mm: np.ndarray | None = None
        self._color_gray: np.ndarray | None = None
        self._history: deque[_FramePair] = deque(maxlen=floor_buffer)

    def set_depth_scale_m(self, value: float) -> None:
        self.depth_scale_m = value

    def update_depth(self, depth_mm: np.ndarray) -> None:
        with self._lock:
            self._depth_mm = depth_mm
            if self._color_gray is not None:
                self._history.append(_FramePair(depth_mm=depth_mm, color_gray=self._color_gray))

    def update_color_gray(self, color_gray: np.ndarray) -> None:
        with self._lock:
            self._color_gray = color_gray
            if self._depth_mm is not None:
                self._history.append(_FramePair(depth_mm=self._depth_mm, color_gray=color_gray))

    def latest(self) -> tuple[np.ndarray | None, np.ndarray | None]:
        with self._lock:
            return self._depth_mm, self._color_gray

    def capture_floor(self, n: int) -> tuple[np.ndarray | None, np.ndarray | None]:
        with self._lock:
            pairs = list(self._history)[-n:]
        if not pairs:
            return None, None
        depth_samples = [p.depth_mm for p in pairs]
        gray_samples = [p.color_gray for p in pairs]
        floor_mm = np.median(np.stack(depth_samples, axis=0), axis=0).astype(np.float32)
        baseline_gray = np.median(np.stack(gray_samples, axis=0), axis=0).astype(np.uint8)
        return floor_mm, baseline_gray

    def close(self) -> None:
        return None
