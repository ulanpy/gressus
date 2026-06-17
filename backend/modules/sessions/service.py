"""Session use cases."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from backend.modules.sessions import repository, schemas
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

_TERMINAL_STATUSES = {
    schemas.SessionStatus.COMPLETED,
    schemas.SessionStatus.FAILED,
    schemas.SessionStatus.ABORTED,
}


class SessionService:
    def __init__(self, db_session: AsyncSession) -> None:
        self._repository = repository.SessionRepository(db_session)

    async def create_session(
        self,
        patient_id: uuid.UUID,
        data: schemas.SessionCreateBody,
    ) -> schemas.SessionRead:
        if not await self._repository.patient_exists_and_active(patient_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found",
            )

        payload = schemas.SessionCreate(patient_id=patient_id, **data.model_dump())
        session = await self._repository.create(payload)
        return schemas.SessionRead.model_validate(session)

    async def list_sessions_for_patient(
        self,
        patient_id: uuid.UUID,
    ) -> list[schemas.SessionRead]:
        if not await self._repository.patient_exists(patient_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found",
            )

        sessions = await self._repository.get_by_patient(patient_id)
        return [schemas.SessionRead.model_validate(session) for session in sessions]

    async def get_session(self, session_id: uuid.UUID) -> schemas.SessionRead:
        session = await self._repository.get_by_id(session_id)
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )
        return schemas.SessionRead.model_validate(session)

    async def update_session(
        self,
        session_id: uuid.UUID,
        data: schemas.SessionUpdate,
    ) -> schemas.SessionRead:
        session = await self._repository.get_by_id(session_id)
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        update_data = data.model_dump(exclude_unset=True)
        if (
            "status" in update_data
            and update_data["status"] in _TERMINAL_STATUSES
            and "ended_at" not in update_data
            and session.ended_at is None
        ):
            update_data["ended_at"] = datetime.now(timezone.utc)

        payload = schemas.SessionUpdate(**update_data)
        updated = await self._repository.update(session_id, payload)
        assert updated is not None
        return schemas.SessionRead.model_validate(updated)
