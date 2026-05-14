from __future__ import annotations

from typing import Any

import cv2
import numpy as np


def start_realsense(
    rs: Any,
    *,
    depth_width: int,
    depth_height: int,
    depth_fps: int,
    color_width: int,
    color_height: int,
    color_fps: int,
) -> tuple[Any, Any, float]:
    pipe = rs.pipeline()
    cfg = rs.config()
    cfg.enable_stream(rs.stream.depth, depth_width, depth_height, rs.format.z16, depth_fps)
    cfg.enable_stream(rs.stream.color, color_width, color_height, rs.format.bgr8, color_fps)
    profile = pipe.start(cfg)
    dev = profile.get_device()
    depth_scale_m = float(dev.first_depth_sensor().get_depth_scale())
    align = rs.align(rs.stream.color)
    return pipe, align, depth_scale_m


def capture_floor(pipe: Any, align: Any, depth_scale_m: float, n: int) -> np.ndarray | None:
    samples: list[np.ndarray] = []
    for _ in range(n):
        try:
            frames = pipe.wait_for_frames(timeout_ms=5000)
        except RuntimeError:
            continue
        frames = align.process(frames)
        d = frames.get_depth_frame()
        if not d:
            continue
        depth_mm = np.asanyarray(d.get_data()).astype(np.float32) * depth_scale_m * 1000.0
        samples.append(depth_mm)
    if not samples:
        return None
    return np.median(np.stack(samples, axis=0), axis=0).astype(np.float32)


def detect_foot_points(
    depth_mm: np.ndarray,
    floor_mm: np.ndarray,
    lift_mm: float,
    min_area: int,
) -> list[tuple[float, float]]:
    valid = depth_mm > 0.0
    delta = floor_mm - depth_mm
    mask = ((delta > lift_mm) & valid).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    points: list[tuple[float, float]] = []
    for c in contours:
        if cv2.contourArea(c) < min_area:
            continue
        pts = c.reshape(-1, 2)
        if pts.shape[0] == 0:
            continue
        # Use only the foot tip (bottom-most band of the silhouette): standing far
        # from the treadmill must not scatter many sample points across the canvas.
        max_y = int(np.max(pts[:, 1]))
        band = pts[pts[:, 1] >= (max_y - 6)]
        if band.shape[0] == 0:
            band = pts
        points.append((float(np.median(band[:, 0])), float(max_y)))
    return points

