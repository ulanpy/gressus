"""Runtime control request/response schemas."""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StartExoRequest(BaseModel):
    """Bring the exoskeleton controller UP via session_manager.

    Runs ``ros2 launch gressus_bringup pgear.launch.py`` — i.e. ONLY
    ``pgear_device_node`` (the exoskeleton controller: P.GEAR telemetry + control).
    Insole / camera are a separate (projector) system, not the exoskeleton.
    Stopping tears that launch down.
    """

    sessionId: UUID | None = None
    patientId: UUID | None = None
    espHost: str | None = None


class StopExoRequest(BaseModel):
    timeoutS: float = Field(3.0, ge=0.5, le=15.0)


class LoadPgearProfileRequest(BaseModel):
    """P.GEAR exo profile JSON (API.md §7); applied via pgear_device_node load_profile service."""

    profileJson: str = Field(min_length=2)


class ExoProfile(BaseModel):
    """Exo profile stored on a session: gait params + kind-0 coeffs (keyed by cps).

    Loose-typed (``extra="allow"``) so it tracks the P.GEAR ``load_profile`` JSON
    without breaking when the firmware coeff model changes. ``coeffs`` rows are
    kind 0 only: ``[joint, 0, [a, b, c, d, e]]``.
    """

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


class PgearRunRequest(BaseModel):
    """Start assisted gait and open a DB session for the patient.

    ``profileJson`` (if given) is the exo profile to record on the new session.
    """

    patientId: UUID
    profileJson: str | None = Field(default=None, min_length=2)


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

    job: Literal["exo"] = "exo"
    sessionId: str | None = None
    patientId: str | None = None
    espHost: str | None = None

    @classmethod
    def from_api(cls, req: StartExoRequest) -> SessionStartPayload:
        return cls.model_validate(req.model_dump(mode="json", exclude_none=True))


class SessionStopPayload(BaseModel):
    """JSON body for ``POST /session/stop`` on session_manager."""

    timeoutS: float = Field(3.0, ge=0.5, le=15.0)

    @classmethod
    def from_api(cls, req: StopExoRequest) -> SessionStopPayload:
        return cls.model_validate(req.model_dump(mode="json"))


class SessionPgearLoadProfilePayload(BaseModel):
    """JSON body for ``POST /session/pgear/load-profile`` on session_manager."""

    profileJson: str = Field(min_length=2)


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


class ExoStartResponse(BaseModel):
    """``POST /session/start`` success body."""

    model_config = ConfigDict(extra="ignore")

    ok: bool
    started: StartedJobSnapshot
    clinicalSession: ClinicalSessionSnapshot | None = None
    runtime: RuntimeSnapshot


class ExoStopResponse(BaseModel):
    """``POST /session/stop`` response body."""

    model_config = ConfigDict(extra="ignore")

    ok: bool
    stopped: bool
    runtime: RuntimeSnapshot


class PgearCommandResponse(BaseModel):
    """P.GEAR device command result (``POST /session/pgear/*``).

    ``sessionId`` is set when a command opens/closes a DB session (run/stop).
    ``coeffs`` carries the kind-0 baseline fit JSON when calibration returns it.
    """

    model_config = ConfigDict(extra="ignore")

    ok: bool
    success: bool
    message: str
    sessionId: UUID | None = None
    coeffs: str | None = None


class CalibrationStatusResponse(BaseModel):
    """Latest async baseline-calibration status (latched ROS topic, polled).

    ``state`` is one of ``idle | running | done | failed | cancelled``. When
    ``state == "done"`` the kind-0 fit is in ``coeffs`` and ``sessionId`` points
    to the open gait session the coeffs were merged into.
    """

    model_config = ConfigDict(extra="ignore")

    ok: bool = True
    state: Literal["idle", "running", "done", "failed", "cancelled"] = "idle"
    message: str = ""
    elapsedS: float = 0.0
    remainingS: float = 0.0
    progress: float = 0.0
    runId: int | None = None
    coeffs: str | None = None
    sessionId: UUID | None = None
