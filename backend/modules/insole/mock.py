"""Synthetic insole pressure frames for mock/demo mode."""

from __future__ import annotations

import numpy as np

from shared.insole_types import N_SENSORS
from backend.modules.insole.geometry import load_insole_geometry
from backend.modules.insole.schemas import InsoleSize


def mock_pressure_values(
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


def mock_pressure_pair(size: InsoleSize, t_sec: float) -> tuple[np.ndarray, np.ndarray]:
    left_mm, right_mm, _ = load_insole_geometry(size)
    left = mock_pressure_values(left_mm, t_sec, phase_offset=0.0)
    right = mock_pressure_values(right_mm, t_sec, phase_offset=0.5)
    return left, right
