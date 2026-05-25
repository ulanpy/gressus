"""Insole pressure frame DTOs and query types."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel

InsoleSize = Literal["m", "s"]
SourceMode = Literal["live"]


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


def frame_to_dict(frame: InsoleFrameResponse) -> dict[str, Any]:
    return frame.model_dump()
