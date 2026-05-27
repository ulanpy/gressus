"""Insole geometry API."""

from __future__ import annotations

from backend.modules.insole.geometry import load_insole_geometry
from backend.modules.insole.schemas import InsoleGeometryResponse, InsoleSize


class InsoleService:
    """Static insole geometry for the frontend heatmap layout."""

    def geometry(self, size: InsoleSize) -> InsoleGeometryResponse:
        left_mm, right_mm, sensor_side_mm = load_insole_geometry(size)
        return InsoleGeometryResponse(
            size=size,
            sensorSideMm=sensor_side_mm,
            left=left_mm,
            right=right_mm,
        )
