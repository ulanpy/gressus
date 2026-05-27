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
    align_to_color: bool = True,
) -> tuple[Any, Any | None, float]:
    pipe = rs.pipeline()
    cfg = rs.config()
    cfg.enable_stream(rs.stream.depth, depth_width, depth_height, rs.format.z16, depth_fps)
    cfg.enable_stream(rs.stream.color, color_width, color_height, rs.format.bgr8, color_fps)
    profile = pipe.start(cfg)
    dev = profile.get_device()
    depth_scale_m = float(dev.first_depth_sensor().get_depth_scale())
    align = rs.align(rs.stream.color) if align_to_color else None
    return pipe, align, depth_scale_m


def capture_floor_and_color(
    pipe: Any, align: Any, depth_scale_m: float, n: int
) -> tuple[np.ndarray | None, np.ndarray | None]:
    """Median depth(mm) and grayscale color baseline over `n` aligned frames."""
    depth_samples: list[np.ndarray] = []
    gray_samples: list[np.ndarray] = []
    for _ in range(n):
        try:
            frames = pipe.wait_for_frames(timeout_ms=5000)
        except RuntimeError:
            continue
        frames = align.process(frames)
        d = frames.get_depth_frame()
        c = frames.get_color_frame()
        if d:
            depth_samples.append(
                np.asanyarray(d.get_data()).astype(np.float32) * depth_scale_m * 1000.0
            )
        if c:
            bgr = np.asanyarray(c.get_data())
            gray_samples.append(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY))
    floor_mm = (
        np.median(np.stack(depth_samples, axis=0), axis=0).astype(np.float32)
        if depth_samples
        else None
    )
    baseline_gray = (
        np.median(np.stack(gray_samples, axis=0), axis=0).astype(np.uint8)
        if gray_samples
        else None
    )
    return floor_mm, baseline_gray


def tile_signals(
    cam_poly: np.ndarray,
    depth_mm: np.ndarray,
    floor_mm: np.ndarray,
    color_gray: np.ndarray | None,
    baseline_gray: np.ndarray | None,
    lift_mm_min: float,
    lift_mm_max: float,
    occlusion_lit_delta: int,
) -> tuple[float, float, int]:
    """Compute (depth_score, rgb_score, area_px) over a quad in camera coords.

    depth_score: fraction of poly pixels where lift_mm_min ≤ (floor_mm - depth_mm) ≤ lift_mm_max.
                 Bandpass: lower bound rejects floor noise, upper bound rejects the
                 patient's body/leg looming over the tile (always lifted by a lot).
    rgb_score:   fraction of poly pixels NOT lit by projector
                 ((color_gray - baseline_gray) ≤ occlusion_lit_delta) — i.e.,
                 projector contribution is missing → likely occluded by a foot.
    """
    h, w = depth_mm.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(mask, [cam_poly.astype(np.int32)], 255)
    m = mask > 0
    total = int(np.count_nonzero(m))
    if total == 0:
        return 0.0, 0.0, 0
    delta_mm = floor_mm - depth_mm
    depth_active = m & (depth_mm > 0.0) & (delta_mm >= lift_mm_min) & (delta_mm <= lift_mm_max)
    depth_score = float(np.count_nonzero(depth_active)) / total
    if color_gray is not None and baseline_gray is not None:
        delta = color_gray.astype(np.int16) - baseline_gray.astype(np.int16)
        not_lit = m & (delta <= occlusion_lit_delta)
        rgb_score = float(np.count_nonzero(not_lit)) / total
    else:
        rgb_score = 0.0
    return depth_score, rgb_score, total
