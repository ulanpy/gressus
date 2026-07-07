"""Runtime use cases: clinical session + rosbag recording via session_manager."""

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
    RuntimeSnapshot,
    SessionActionResponse,
    SessionRosbagStartPayload,
)
from backend.modules.sessions.analytics import queue_session_analytics
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
    """Per-request runtime: DB session lifecycle + rosbag via session_manager."""

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

    async def snapshot(self) -> RuntimeSnapshot:
        body = await self._call(self._session_manager.get_status)
        return body.runtime

    async def _open_session(self) -> Session | None:
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

    async def start_session(
        self, patient_id: UUID, profile_json: str | None
    ) -> SessionActionResponse:
        patient = await self._patients.get_by_id(patient_id)
        if patient is None:
            raise HTTPException(status_code=404, detail=f"patient {patient_id} not found")

        exo_profile = _unwrap_profile(profile_json)

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

        return SessionActionResponse(
            ok=True,
            success=True,
            message="logging session started",
            sessionId=session_obj.id,
        )

    async def stop_session(self) -> SessionActionResponse:
        session_obj = await self._open_session()
        if session_obj is None:
            return SessionActionResponse(
                ok=True,
                success=True,
                message="no open session",
            )

        session_obj.status = SessionStatus.COMPLETED
        session_obj.ended_at = _now()
        queue_session_analytics(session_obj)
        await self._sessions.flush()
        await self._try_stop_rosbag()

        return SessionActionResponse(
            ok=True,
            success=True,
            message="logging session stopped",
            sessionId=session_obj.id,
        )

    async def _try_start_rosbag(self, session_id: UUID, patient_id: UUID) -> None:
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
