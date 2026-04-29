"""load_calibration() + cam_to_proj()."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


@dataclass(frozen=True)
class CameraCalibration:
    H_cam_to_proj: np.ndarray  # 3x3 float64
    H_proj_to_cam: np.ndarray
    proj_resolution: tuple[int, int]
    flip_horizontal: bool
    camera_index: str | int
    raw: dict

    def cam_to_proj(self, x: float, y: float, frame_w: int) -> tuple[float, float]:
        """Пиксель кадра камеры → пиксель проектора (логические координаты окна)."""
        xf, yf = float(x), float(y)
        if self.flip_horizontal:
            xf = frame_w - 1.0 - xf
        pts = np.array([[[xf, yf]]], dtype=np.float32)
        out = cv2.perspectiveTransform(pts, self.H_cam_to_proj)
        return float(out[0, 0, 0]), float(out[0, 0, 1])


def load_calibration(path: Path | str) -> CameraCalibration:
    path = Path(path)
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    H = np.array(raw["H_cam_to_proj"], dtype=np.float64)
    Hi = np.array(raw["H_proj_to_cam"], dtype=np.float64)
    pw, ph = int(raw["proj_resolution"][0]), int(raw["proj_resolution"][1])
    flip = bool(raw.get("flip_horizontal", False))
    cam = raw.get("camera_index", 0)
    if isinstance(cam, str) and cam.isdigit():
        cam = int(cam)
    return CameraCalibration(
        H_cam_to_proj=H,
        H_proj_to_cam=Hi,
        proj_resolution=(pw, ph),
        flip_horizontal=flip,
        camera_index=cam,
        raw=raw,
    )
