"""Insole pressure frame DTOs and query types."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

InsoleSize = Literal["m", "s"]


class InsoleGeometryResponse(BaseModel):
    size: InsoleSize
    sensorSideMm: float
    left: tuple[tuple[float, float], ...]
    right: tuple[tuple[float, float], ...]
