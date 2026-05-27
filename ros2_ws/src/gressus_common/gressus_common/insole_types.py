"""Shared insole pressure types used by ROS nodes."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

N_SENSORS = 64


@dataclass(frozen=True)
class PressureStats:
    max_kpa: float = 0.0
    mean_kpa: float = 0.0
    sum_kpa: float = 0.0
    pressed: bool = False
    has_data: bool = False


@dataclass(frozen=True)
class InsoleSnapshot:
    obj: dict[str, Any]
    left: np.ndarray | None
    right: np.ndarray | None
    left_stats: PressureStats
    right_stats: PressureStats
    age_s: float | None
    connected: bool
    error: str | None

    @property
    def has_recent_data(self) -> bool:
        return self.age_s is not None


def latest_scan(obj: dict[str, Any]) -> tuple[np.ndarray | None, np.ndarray | None]:
    """Extract the latest L/R 64-sensor scan from a bridge JSON object."""
    return _one_latest_scan(obj.get("L")), _one_latest_scan(obj.get("R"))


def pressure_stats(values: np.ndarray | None, threshold_kpa: float) -> PressureStats:
    if values is None or values.size == 0:
        return PressureStats()
    clean = np.nan_to_num(values.astype(np.float64, copy=False), nan=0.0, posinf=0.0, neginf=0.0)
    if clean.size == 0:
        return PressureStats()
    max_kpa = float(np.max(clean))
    mean_kpa = float(np.mean(clean))
    sum_kpa = float(np.sum(clean))
    return PressureStats(
        max_kpa=max_kpa,
        mean_kpa=mean_kpa,
        sum_kpa=sum_kpa,
        pressed=max_kpa >= threshold_kpa,
        has_data=True,
    )


def _one_latest_scan(raw: Any) -> np.ndarray | None:
    if not isinstance(raw, list) or not raw:
        return None
    last = raw[-1]
    if not isinstance(last, list) or len(last) < N_SENSORS:
        return None
    return np.array(last[:N_SENSORS], dtype=np.float64)
