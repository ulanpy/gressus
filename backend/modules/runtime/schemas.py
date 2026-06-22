"""Runtime control request/response schemas."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from backend.core.configs.config import config


class StartRuntimeRequest(BaseModel):
    job: Literal["game", "calibrate_apriltag"]
    sessionId: UUID | None = None
    patientId: UUID | None = None
    display: int | None = None
    outputRotation: Literal[0, 90, 180, 270] = 270
    insoleThresholdKpa: float = Field(config.INSOLE_THRESHOLD_KPA, ge=0.0)
    noInsole: bool = False
    demo: bool = False
    speed: float = Field(0.35, ge=0.05, le=1.5)
    stepTimeS: float = Field(2.5, ge=0.2, le=2.8)


class StopRuntimeRequest(BaseModel):
    timeoutS: float = Field(3.0, ge=0.5, le=15.0)
