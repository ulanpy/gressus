"""Calibration loader: canvas <-> camera homography.

The game renders tiles on a canvas, then rotates that canvas to fit the
projector's framebuffer. Calibration does the exact same rendering pipeline
and detects AprilTags in the camera image, so the saved homography maps
*canvas pixels* directly to *camera pixels*. The game uses it directly when
sampling depth/colour ROI for a tile, with no rotation / FB intermediate.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np


CALIBRATION_VERSION = 2


@dataclass(frozen=True)
class CameraCalibration:
    H_canvas_to_cam: np.ndarray  # 3x3 float64
    H_cam_to_canvas: np.ndarray  # 3x3 float64
    canvas_resolution: tuple[int, int]  # (cw, ch)
    screen_resolution: tuple[int, int]  # (scr_w, scr_h)
    output_rotation: int  # 0 / 90 / 180 / 270
    flip_horizontal: bool
    camera_index: str | int
    raw: dict


def load_calibration(path: Path | str) -> CameraCalibration:
    path = Path(path)
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    version = int(raw.get("version", 0))
    if version != CALIBRATION_VERSION:
        raise RuntimeError(
            f"calibration {path} has version {version}, expected {CALIBRATION_VERSION}. "
            "Re-run gressus_calibration/calibrate_apriltag to regenerate it."
        )
    H = np.array(raw["H_canvas_to_cam"], dtype=np.float64)
    Hi = np.array(raw["H_cam_to_canvas"], dtype=np.float64)
    cw, ch = int(raw["canvas_resolution"][0]), int(raw["canvas_resolution"][1])
    sw, sh = int(raw["screen_resolution"][0]), int(raw["screen_resolution"][1])
    rot = int(raw["output_rotation"])
    if rot not in (0, 90, 180, 270):
        raise RuntimeError(f"output_rotation {rot} in {path} must be 0/90/180/270")
    flip = bool(raw.get("flip_horizontal", False))
    cam = raw.get("camera_index", 0)
    if isinstance(cam, str) and cam.isdigit():
        cam = int(cam)
    return CameraCalibration(
        H_canvas_to_cam=H,
        H_cam_to_canvas=Hi,
        canvas_resolution=(cw, ch),
        screen_resolution=(sw, sh),
        output_rotation=rot,
        flip_horizontal=flip,
        camera_index=cam,
        raw=raw,
    )
