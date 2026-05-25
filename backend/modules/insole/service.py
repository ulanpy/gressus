"""Insole frame assembly from live TCP ingest."""

from __future__ import annotations

from typing import Any

import numpy as np

from backend.core.configs.config import Config
from backend.modules.insole.receiver import InsoleTcpReceiver
from shared.insole_types import N_SENSORS, pressure_stats
from backend.modules.insole.geometry import load_insole_geometry
from backend.modules.insole.schemas import (
    InsoleFrameResponse,
    InsoleGeometryResponse,
    InsoleSize,
    PressureStatsResponse,
)
from backend.runtime.process_manager import ProcessManager


class InsoleService:
    """HTTP-agnostic use cases for insole visualization frames."""

    def __init__(
        self,
        *,
        receiver: InsoleTcpReceiver | None,
        process_manager: ProcessManager,
        config: Config,
    ) -> None:
        self._receiver = receiver
        self._process_manager = process_manager
        self._config = config

    def geometry(self, size: InsoleSize) -> InsoleGeometryResponse:
        left_mm, right_mm, sensor_side_mm = load_insole_geometry(size)
        return InsoleGeometryResponse(
            size=size,
            sensorSideMm=sensor_side_mm,
            left=left_mm,
            right=right_mm,
        )

    def frame(self, *, size: InsoleSize, threshold_kpa: float) -> InsoleFrameResponse:
        if self._receiver is None:
            return self._passive_live_frame(size)
        snapshot = self._receiver.latest_snapshot(threshold_kpa)
        return self._build_frame(
            size=size,
            obj=snapshot.obj,
            left=snapshot.left,
            right=snapshot.right,
            threshold_kpa=threshold_kpa,
            connected=snapshot.connected,
            age_s=snapshot.age_s,
            error=snapshot.error,
            available=True,
            game_running=self.is_game_running(),
        )

    def is_game_running(self) -> bool:
        snap = self._process_manager.snapshot()
        active = snap.get("activeJob") or {}
        return active.get("name") == "game"

    def _passive_live_frame(self, size: InsoleSize) -> InsoleFrameResponse:
        return self._build_frame(
            size=size,
            obj={},
            left=None,
            right=None,
            threshold_kpa=0.0,
            connected=False,
            age_s=None,
            error=None,
            available=False,
            game_running=False,
        )

    def _build_frame(
        self,
        *,
        size: InsoleSize,
        obj: dict[str, Any],
        left: np.ndarray | None,
        right: np.ndarray | None,
        threshold_kpa: float,
        connected: bool,
        age_s: float | None,
        error: str | None,
        available: bool,
        game_running: bool,
    ) -> InsoleFrameResponse:
        return InsoleFrameResponse(
            size=size,
            source="live",
            available=available,
            gameRunning=game_running,
            seq=obj.get("seq"),
            dtMs=obj.get("dtMs"),
            connected=connected,
            ageS=age_s,
            error=error,
            leftOnline=bool(obj.get("L_online", left is not None)),
            rightOnline=bool(obj.get("R_online", right is not None)),
            left=self._values_payload(left),
            right=self._values_payload(right),
            leftStats=self._stats_payload(left, threshold_kpa),
            rightStats=self._stats_payload(right, threshold_kpa),
        )

    @staticmethod
    def _stats_payload(values: np.ndarray | None, threshold_kpa: float) -> PressureStatsResponse:
        stats = pressure_stats(values, threshold_kpa)
        return PressureStatsResponse(
            maxKpa=stats.max_kpa,
            meanKpa=stats.mean_kpa,
            sumKpa=stats.sum_kpa,
            pressed=stats.pressed,
            hasData=stats.has_data,
        )

    @staticmethod
    def _values_payload(values: np.ndarray | None) -> list[float] | None:
        if values is None:
            return None
        clean = np.nan_to_num(values[:N_SENSORS], nan=0.0, posinf=0.0, neginf=0.0)
        return [float(v) for v in clean]
