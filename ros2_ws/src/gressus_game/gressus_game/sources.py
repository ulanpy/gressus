"""ROS topic feeds for tile_game."""

from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Protocol

import numpy as np

from gressus_game.insole_ros_feed import RosInsoleFeed
from gressus_common.insole_types import InsoleSnapshot


class InsoleFeed(Protocol):
    def latest(self, threshold_kpa: float) -> InsoleSnapshot | None: ...

    def close(self) -> None: ...


class CameraFeed(Protocol):
    depth_scale_m: float

    def latest(self) -> tuple[np.ndarray | None, np.ndarray | None]: ...

    def capture_floor(self, n: int) -> tuple[np.ndarray | None, np.ndarray | None]: ...

    def close(self) -> None: ...


@dataclass
class _FramePair:
    depth_mm: np.ndarray
    color_gray: np.ndarray


class RosCameraFeed:
    """Thread-safe cache of aligned depth/color frames from ROS image topics."""

    def __init__(self, *, depth_scale_m: float = 0.001, floor_buffer: int = 64) -> None:
        self.depth_scale_m = depth_scale_m
        self._lock = threading.Lock()
        self._depth_mm: np.ndarray | None = None
        self._color_gray: np.ndarray | None = None
        self._history: deque[_FramePair] = deque(maxlen=floor_buffer)
        self._depth_count = 0
        self._color_count = 0

    def set_depth_scale_m(self, value: float) -> None:
        self.depth_scale_m = value

    def update_depth(self, depth_mm: np.ndarray) -> None:
        with self._lock:
            self._depth_count += 1
            self._depth_mm = depth_mm
            if self._color_gray is not None:
                self._history.append(_FramePair(depth_mm=depth_mm, color_gray=self._color_gray))

    def update_color_gray(self, color_gray: np.ndarray) -> None:
        with self._lock:
            self._color_count += 1
            self._color_gray = color_gray
            if self._depth_mm is not None:
                self._history.append(_FramePair(depth_mm=self._depth_mm, color_gray=color_gray))

    def latest(self) -> tuple[np.ndarray | None, np.ndarray | None]:
        with self._lock:
            if self._history:
                pair = self._history[-1]
                return pair.depth_mm, pair.color_gray
            return self._depth_mm, self._color_gray

    def has_aligned_frames(self) -> bool:
        with self._lock:
            return bool(self._history) or (
                self._depth_mm is not None and self._color_gray is not None
            )

    def stats_line(self) -> str:
        with self._lock:
            return (
                f"depth={self._depth_count} color={self._color_count} "
                f"pairs={len(self._history)}"
            )

    def capture_floor(
        self,
        n: int,
        *,
        wait_s: float = 3.0,
        min_pairs: int = 12,
    ) -> tuple[np.ndarray | None, np.ndarray | None]:
        deadline = time.monotonic() + max(0.0, wait_s)
        pairs: list[_FramePair] = []
        while time.monotonic() < deadline:
            with self._lock:
                pairs = list(self._history)[-n:]
                if len(pairs) >= min(min_pairs, n):
                    break
            time.sleep(0.05)

        with self._lock:
            if not pairs:
                pairs = list(self._history)[-n:]
            if not pairs and self._depth_mm is not None and self._color_gray is not None:
                pairs = [_FramePair(depth_mm=self._depth_mm, color_gray=self._color_gray)]

        if not pairs:
            return None, None

        depth_samples = [p.depth_mm for p in pairs]
        gray_samples = [p.color_gray for p in pairs]
        floor_mm = np.median(np.stack(depth_samples, axis=0), axis=0).astype(np.float32)
        baseline_gray = np.median(np.stack(gray_samples, axis=0), axis=0).astype(np.uint8)
        return floor_mm, baseline_gray

    def close(self) -> None:
        return None


__all__ = ["CameraFeed", "InsoleFeed", "RosCameraFeed", "RosInsoleFeed"]
