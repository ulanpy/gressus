"""Runtime use cases.

One per-request service that ties together:
- ROS stack lifecycle (start/stop the clinical ``feedback`` launch),
- P.GEAR device commands (proxied to ``pgear_device_node`` via session_manager),
- the clinical gait-session coupling: ``run`` opens a DB session, ``stop_gait`` /
  ``disarm`` close it, and ``calibrate_baseline`` merges kind-0 coeffs into it.

The only app-singleton is :class:`SessionManagerClient` (it owns the httpx
connection pool). This service is built per request with a fresh DB session;
the ``get_db_session`` dependency commits on success.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from typing import Any, TypeVar
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.modules.patients.repository import PatientRepository
from backend.modules.runtime.client import SessionManagerClient, SessionManagerError
from backend.modules.runtime.schemas import (
    CalibrationStatusResponse,
    ExoStartResponse,
    ExoStopResponse,
    PgearCommandResponse,
    RuntimeSnapshot,
    SessionPgearCalibrateBaselinePayload,
    SessionPgearLoadProfilePayload,
    SessionRosbagStartPayload,
    SessionStartPayload,
    SessionStopPayload,
    StartExoRequest,
    StopExoRequest,
)
from backend.modules.sessions.enums import SessionStatus
from backend.modules.sessions.models import Session
from backend.modules.sessions.repository import SessionRepository

logger = logging.getLogger(__name__)

T = TypeVar("T")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _unwrap_profile(profile_json: str | None) -> dict[str, Any] | None:
    if not profile_json:
        return None
    try:
        parsed = json.loads(profile_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"profileJson is not valid JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=422, detail="profileJson must be a JSON object")
    inner = parsed.get("profile", parsed)
    if not isinstance(inner, dict):
        raise HTTPException(status_code=422, detail="profile field must be an object")
    return inner


class RuntimeService:
    """Per-request runtime control + gait-session orchestration."""

    def __init__(self, *, db: AsyncSession, session_manager: SessionManagerClient) -> None:
        self._db = db
        self._session_manager = session_manager
        self._sessions = SessionRepository(db)
        self._patients = PatientRepository(db)

    async def _call(self, fn: Callable[[], Awaitable[T]]) -> T:
        try:
            return await fn()
        except SessionManagerError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    # ------- Exoskeleton stack lifecycle (raise/lower the ROS launch) ---

    async def snapshot(self) -> RuntimeSnapshot:
        body = await self._call(self._session_manager.get_status)
        return body.runtime

    async def start_exo(self, cfg: StartExoRequest) -> ExoStartResponse:
        """Bring the exo controller up (launches only pgear_device_node)."""
        payload = SessionStartPayload.from_api(cfg)
        return await self._call(lambda: self._session_manager.start_exo(payload))

    async def stop_exo(self, cfg: StopExoRequest) -> ExoStopResponse:
        """Tear the exo controller launch down."""
        payload = SessionStopPayload.from_api(cfg)
        return await self._call(lambda: self._session_manager.stop_exo(payload))

    # ------- P.GEAR commands without DB side effects -------------------

    async def pgear_load_profile(self, profile_json: str) -> PgearCommandResponse:
        payload = SessionPgearLoadProfilePayload(profileJson=profile_json)
        return await self._call(lambda: self._session_manager.pgear_load_profile(payload))

    async def pgear_arm(self) -> PgearCommandResponse:
        return await self._call(self._session_manager.pgear_arm)

    async def pgear_estop(self) -> PgearCommandResponse:
        return await self._call(self._session_manager.pgear_estop)

    async def pgear_estop_reset(self) -> PgearCommandResponse:
        return await self._call(self._session_manager.pgear_estop_reset)

    async def pgear_full_cal(self) -> PgearCommandResponse:
        return await self._call(self._session_manager.pgear_full_cal)

    # ------- P.GEAR commands coupled to the clinical session ----------

    async def _open_gait_session(self) -> Session | None:
        """The currently open gait session (single exo device): started, not ended."""
        stmt = (
            select(Session)
            .where(
                Session.status == SessionStatus.ACTIVE,
                Session.started_at.is_not(None),
                Session.ended_at.is_(None),
            )
            .order_by(Session.started_at.desc())
        )
        result = await self._db.execute(stmt)
        return result.scalars().first()

    async def pgear_run(self, patient_id: UUID, profile_json: str | None) -> PgearCommandResponse:
        patient = await self._patients.get_by_id(patient_id)
        if patient is None:
            raise HTTPException(status_code=404, detail=f"patient {patient_id} not found")

        exo_profile = _unwrap_profile(profile_json)

        resp = await self._call(self._session_manager.pgear_run)
        if not resp.success:
            # Device refused gait — do not open a session.
            return resp

        next_number = await self._sessions.max_session_number(patient_id) + 1
        now = _now()
        session_obj = Session(
            patient_id=patient_id,
            session_number=next_number,
            status=SessionStatus.ACTIVE,
            session_date=now.date(),
            started_at=now,
            exo_profile=exo_profile,
        )
        await self._sessions.add(session_obj)
        await self._try_start_rosbag(session_obj.id, patient_id)
        return resp.model_copy(update={"sessionId": session_obj.id})

    async def _try_start_rosbag(self, session_id: UUID, patient_id: UUID) -> None:
        """Best-effort: record the ROS topics for this gait session. Never blocks gait."""
        payload = SessionRosbagStartPayload(sessionId=str(session_id), patientId=str(patient_id))
        try:
            result = await self._session_manager.rosbag_start(payload)
            if not result.ok:
                logger.warning("rosbag start declined: %s", result.error)
        except Exception as exc:  # noqa: BLE001 — recording must not break the session
            logger.warning("rosbag start failed: %s", exc)

    async def _try_stop_rosbag(self) -> None:
        try:
            await self._session_manager.rosbag_stop()
        except Exception as exc:  # noqa: BLE001
            logger.warning("rosbag stop failed: %s", exc)

    async def _finish_open_session(self, resp: PgearCommandResponse) -> PgearCommandResponse:
        if not resp.success:
            return resp
        session_obj = await self._open_gait_session()
        if session_obj is None:
            return resp
        session_obj.status = SessionStatus.COMPLETED
        session_obj.ended_at = _now()
        await self._sessions.flush()
        await self._try_stop_rosbag()
        return resp.model_copy(update={"sessionId": session_obj.id})

    async def pgear_stop_gait(self) -> PgearCommandResponse:
        resp = await self._call(self._session_manager.pgear_stop_gait)
        return await self._finish_open_session(resp)

    async def pgear_disarm(self) -> PgearCommandResponse:
        resp = await self._call(self._session_manager.pgear_disarm)
        return await self._finish_open_session(resp)

    async def pgear_calibrate_baseline(self, duration_s: float = 0.0) -> PgearCommandResponse:
        """Kick off baseline calibration; returns immediately (``started``).

        Calibration runs 30-130 s on the device. Poll :meth:`calibration_status`
        for progress and the final coeffs (which get merged into the open session).
        """
        payload = SessionPgearCalibrateBaselinePayload(durationS=duration_s)
        return await self._call(lambda: self._session_manager.pgear_calibrate_baseline(payload))

    async def pgear_cancel_calibrate(self) -> PgearCommandResponse:
        return await self._call(self._session_manager.pgear_cancel_calibrate)

    async def calibration_status(self) -> CalibrationStatusResponse:
        status = await self._call(self._session_manager.get_calibration_status)
        if status.state != "done" or not status.coeffs:
            return status
        session_id = await self._merge_coeffs_into_open_session(status.coeffs)
        if session_id is None:
            return status
        return status.model_copy(update={"sessionId": session_id})

    async def _merge_coeffs_into_open_session(self, coeffs_json: str) -> UUID | None:
        """Persist kind-0 coeffs into the open gait session; idempotent per fit ``ts``."""
        try:
            data = json.loads(coeffs_json)
        except json.JSONDecodeError:
            return None
        if isinstance(data, list):
            coeffs, meta = data, None
        elif isinstance(data, dict):
            coeffs, meta = data.get("coeffs"), data.get("meta")
        else:
            return None
        if coeffs is None:
            return None

        session_obj = await self._open_gait_session()
        if session_obj is None:
            return None

        existing = session_obj.exo_profile if isinstance(session_obj.exo_profile, dict) else {}
        new_ts = (meta or {}).get("ts")
        existing_ts = (existing.get("meta") or {}).get("ts")
        if new_ts and existing_ts == new_ts and existing.get("coeffs"):
            return session_obj.id  # already merged this fit

        profile = dict(existing)
        profile["coeffs"] = coeffs
        if meta is not None:
            profile["meta"] = meta
        session_obj.exo_profile = profile
        await self._sessions.flush()
        return session_obj.id
