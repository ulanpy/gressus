"""Runtime control request/response schemas."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

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


class CalibratePgearBaselineRequest(BaseModel):
    """Empty-exo baseline fit (~30 s). Device must be ARM+RUN in GAIT before calling."""

    durationS: float = Field(0.0, ge=0.0, le=120.0, description="0 = default 30 s")


class SessionPgearCalibrateBaselinePayload(BaseModel):
    """JSON body for ``POST /session/pgear/calibrate-baseline`` on session_manager."""

    durationS: float = Field(0.0, ge=0.0, le=120.0)

    @classmethod
    def from_api(cls, req: CalibratePgearBaselineRequest) -> SessionPgearCalibrateBaselinePayload:
        return cls(durationS=req.durationS)


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


class ClinicalSessionSnapshot(BaseModel):
    """Clinical ids injected by session_manager into launch env."""

    model_config = ConfigDict(extra="ignore")

    sessionId: str
    patientId: str
    dataDir: str | None = None


class ActiveJobSnapshot(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    command: list[str]
    pid: int
    uptimeS: float = Field(ge=0.0)


class LastExitSnapshot(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    code: int | None = None
    finishedAt: float | None = None


class RuntimeSnapshot(BaseModel):
    """Launch job state returned by ``GET /session/status`` → ``runtime``."""

    model_config = ConfigDict(extra="ignore")

    state: Literal["idle", "running"]
    activeJob: ActiveJobSnapshot | None = None
    lastExit: LastExitSnapshot | None = None
    clinicalSession: ClinicalSessionSnapshot | None = None


class SessionStatusResponse(BaseModel):
    """``GET /session/status`` response body."""

    model_config = ConfigDict(extra="ignore")

    ok: bool
    runtime: RuntimeSnapshot


class StartedJobSnapshot(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    pid: int
    command: list[str]


class StackStartResponse(BaseModel):
    """``POST /session/start`` success body."""

    model_config = ConfigDict(extra="ignore")

    ok: bool
    started: StartedJobSnapshot
    clinicalSession: ClinicalSessionSnapshot | None = None
    runtime: RuntimeSnapshot


class StackStopResponse(BaseModel):
    """``POST /session/stop`` response body."""

    model_config = ConfigDict(extra="ignore")

    ok: bool
    stopped: bool
    runtime: RuntimeSnapshot


class PgearCommandResponse(BaseModel):
    """P.GEAR device command result (``POST /session/pgear/*``)."""

    model_config = ConfigDict(extra="ignore")

    ok: bool
    success: bool
    message: str
