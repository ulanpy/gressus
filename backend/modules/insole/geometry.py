"""Insole sensor geometry helpers."""

from __future__ import annotations

from backend.modules.insole.schemas import InsoleSize


def load_insole_geometry(size: InsoleSize) -> tuple[
    tuple[tuple[float, float], ...],
    tuple[tuple[float, float], ...],
    float,
]:
    if size == "s":
        from backend.modules.insole.sensors_s import LEFT_MM, RIGHT_MM, SENSOR_SIDE_MM
    else:
        from backend.modules.insole.sensors_m import LEFT_MM, RIGHT_MM, SENSOR_SIDE_MM
    return LEFT_MM, RIGHT_MM, SENSOR_SIDE_MM
