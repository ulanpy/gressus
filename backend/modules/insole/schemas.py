"""Insole pressure frame DTOs and query types."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from backend.core.configs.config import config

InsoleSize = Literal["m", "s"]
SourceMode = Literal["live", "mock"]


class PressureStatsResponse(BaseModel):
    maxKpa: float = 0.0
    meanKpa: float = 0.0
    sumKpa: float = 0.0
    pressed: bool = False
    hasData: bool = False


class InsoleFrameResponse(BaseModel):
    size: InsoleSize
    source: SourceMode
    available: bool = True
    gameRunning: bool = False
    seq: int | None = None
    dtMs: float | None = None
    connected: bool = False
    ageS: float | None = None
    error: str | None = None
    leftOnline: bool = False
    rightOnline: bool = False
    left: list[float] | None = None
    right: list[float] | None = None
    leftStats: PressureStatsResponse
    rightStats: PressureStatsResponse


class InsoleGeometryResponse(BaseModel):
    size: InsoleSize
    sensorSideMm: float
    left: tuple[tuple[float, float], ...]
    right: tuple[tuple[float, float], ...]


def default_threshold_kpa() -> float:
    return config.INSOLE_THRESHOLD_KPA


class InsoleWsQuery(BaseModel):
    size: InsoleSize = "m"
    source: SourceMode = "live"
    threshold_kpa: float = Field(default_factory=default_threshold_kpa, ge=0)
    hz: float = Field(50.0, ge=1.0, le=60.0)


def frame_to_dict(frame: InsoleFrameResponse) -> dict[str, Any]:
    return frame.model_dump()
