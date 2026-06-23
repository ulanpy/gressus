"""Runtime control request/response schemas."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from backend.core.configs.config import config


class StartStackRequest(BaseModel):
    """Launch a ROS stack via session_manager (clinical feedback or legacy projector game)."""

    job: Literal["game", "calibrate_apriltag", "feedback"]
    sessionId: UUID | None = None
    patientId: UUID | None = None
    espHost: str | None = None
    display: int | None = None
    outputRotation: Literal[0, 90, 180, 270] = 270
    insoleThresholdKpa: float = Field(config.INSOLE_THRESHOLD_KPA, ge=0.0)
    noInsole: bool = False
    demo: bool = False
    speed: float = Field(0.35, ge=0.05, le=1.5)
    stepTimeS: float = Field(2.5, ge=0.2, le=2.8)


# Backward-compatible alias for existing frontend routes.
StartRuntimeRequest = StartStackRequest


class StopStackRequest(BaseModel):
    timeoutS: float = Field(3.0, ge=0.5, le=15.0)


StopRuntimeRequest = StopStackRequest


class LoadPgearProfileRequest(BaseModel):
    """P.GEAR exo profile JSON (API.md §7); applied via pgear_device_node load_profile service."""

    profileJson: str = Field(min_length=2)


class PgearCommandResponse(BaseModel):
    """Result of a P.GEAR device command proxied through session_manager."""

    ok: bool
    success: bool
    message: str


class SessionStartPayload(BaseModel):
    """JSON body for ``POST /session/start`` on session_manager."""

    job: Literal["game", "calibrate_apriltag", "feedback"]
    sessionId: str | None = None
    patientId: str | None = None
    espHost: str | None = None
    display: int | None = None
    outputRotation: Literal[0, 90, 180, 270] = 270
    insoleThresholdKpa: float = Field(config.INSOLE_THRESHOLD_KPA, ge=0.0)
    noInsole: bool = False
    demo: bool = False
    speed: float = Field(0.35, ge=0.05, le=1.5)
    stepTimeS: float = Field(2.5, ge=0.2, le=2.8)

    @classmethod
    def from_api(cls, req: StartStackRequest) -> SessionStartPayload:
        return cls.model_validate(req.model_dump(mode="json", exclude_none=True))


class SessionStopPayload(BaseModel):
    """JSON body for ``POST /session/stop`` on session_manager."""

    timeoutS: float = Field(3.0, ge=0.5, le=15.0)

    @classmethod
    def from_api(cls, req: StopStackRequest) -> SessionStopPayload:
        return cls.model_validate(req.model_dump(mode="json"))


class SessionPgearLoadProfilePayload(BaseModel):
    """JSON body for ``POST /session/pgear/load-profile`` on session_manager."""

    profileJson: str = Field(min_length=2)
