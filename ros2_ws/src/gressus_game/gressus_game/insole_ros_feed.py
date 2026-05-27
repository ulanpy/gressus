"""Thread-safe cache of the latest InsolePressure ROS message."""

from __future__ import annotations

import threading

import numpy as np

from gressus_common.insole_types import InsoleSnapshot, N_SENSORS, pressure_stats


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
