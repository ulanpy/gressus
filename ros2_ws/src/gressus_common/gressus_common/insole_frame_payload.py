"""Build the JSON frame payload shared by insole WebSocket clients."""

from __future__ import annotations

from typing import Any, Literal

import numpy as np

from gressus_common.insole_types import InsoleSnapshot, N_SENSORS, pressure_stats

InsoleSize = Literal["m", "s"]


def frame_from_snapshot(
    snapshot: InsoleSnapshot,
    *,
    size: InsoleSize = "m",
    threshold_kpa: float,
    game_running: bool = False,
) -> dict[str, Any]:
    obj = snapshot.obj
    left = snapshot.left
    right = snapshot.right
    available = snapshot.connected or snapshot.has_recent_data
    return {
        "size": size,
        "source": "live",
        "available": available,
        "gameRunning": game_running,
        "seq": obj.get("seq"),
        "dtMs": obj.get("dtMs"),
        "connected": snapshot.connected,
        "ageS": snapshot.age_s,
        "error": snapshot.error,
        "leftOnline": bool(obj.get("L_online", left is not None)),
        "rightOnline": bool(obj.get("R_online", right is not None)),
        "left": _values_payload(left),
        "right": _values_payload(right),
        "leftStats": _stats_payload(left, threshold_kpa),
        "rightStats": _stats_payload(right, threshold_kpa),
    }


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
