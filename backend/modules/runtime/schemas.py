"""Runtime control request/response schemas."""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from backend.modules.sessions.schemas import SessionAnthropometrics


class ExoProfile(BaseModel):
    """Exo profile stored on a session: gait params + optional kind-0 coeffs."""

    model_config = ConfigDict(extra="allow")

    mode: str | None = None
    cps: float | None = None
    amp_r: float | None = None
    amp_l: float | None = None
    assist: float | None = None
    aan: bool | None = None
    rom: dict[str, list[float]] | None = None
    enable: dict[str, bool] | None = None
    coeffs: list[list[Any]] | None = None
    meta: dict[str, Any] | None = None


class SessionStartRequest(BaseModel):
    """Open a clinical session and start rosbag recording."""

    patientId: UUID
    profileJson: str | None = Field(default=None, min_length=2)
    anthropometrics: SessionAnthropometrics | None = None


class SessionRosbagStartPayload(BaseModel):
    """JSON body for ``POST /session/rosbag/start`` on session_manager."""

    sessionId: str
    patientId: str | None = None


class RosbagResponse(BaseModel):
    """``POST /session/rosbag/{start,stop}`` response (best-effort recording)."""

    model_config = ConfigDict(extra="ignore")

    ok: bool = False
    dir: str | None = None
    pid: int | None = None
    stopped: bool | None = None
    error: str | None = None


class ActiveJobSnapshot(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    command: list[str]
    pid: int
    uptimeS: float = Field(ge=0.0)
    dir: str | None = None


class PgearStatusSnapshot(BaseModel):
    """UDP telemetry probe from session_manager."""

    model_config = ConfigDict(extra="ignore")

    nodeAvailable: bool = False
    connected: bool = False
    error: str | None = None


class RuntimeSnapshot(BaseModel):
    """Runtime state returned by ``GET /session/status`` → ``runtime``."""

    model_config = ConfigDict(extra="ignore")

    state: Literal["idle", "running"]
    activeJob: ActiveJobSnapshot | None = None
    pgear: PgearStatusSnapshot = Field(default_factory=PgearStatusSnapshot)


class SessionStatusResponse(BaseModel):
    """``GET /session/status`` response body."""

    model_config = ConfigDict(extra="ignore")

    ok: bool
    runtime: RuntimeSnapshot


class SessionActionResponse(BaseModel):
    """Result of starting or stopping a logging session."""

    model_config = ConfigDict(extra="ignore")

    ok: bool
    success: bool
    message: str
    sessionId: UUID | None = None
