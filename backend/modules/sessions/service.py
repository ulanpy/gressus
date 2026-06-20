"""Session use cases and domain rules."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.modules.patients.repository import PatientRepository
from backend.modules.sessions.enums import SessionStatus
from backend.modules.sessions.models import Session
from backend.modules.sessions.repository import SessionRepository
from backend.modules.sessions.schemas import SessionCreate, SessionUpdate


class SessionService:
    def __init__(self, session: AsyncSession) -> None:
        self._repo = SessionRepository(session)
        self._patients = PatientRepository(session)

    async def _ensure_patient(self, patient_id: UUID) -> None:
        patient = await self._patients.get(patient_id)
        if patient is None:
            raise HTTPException(status_code=404, detail=f"patient {patient_id} not found")

    async def get_or_404(self, patient_id: UUID, session_id: UUID) -> Session:
        session_obj = await self._repo.get(session_id)
        if session_obj is None or session_obj.patient_id != patient_id:
            raise HTTPException(
                status_code=404,
                detail=f"session {session_id} not found for patient {patient_id}",
            )
        return session_obj

    async def list_for_patient(
        self, patient_id: UUID, *, limit: int = 100, offset: int = 0
    ) -> Sequence[Session]:
        await self._ensure_patient(patient_id)
        return await self._repo.list_for_patient(patient_id, limit=limit, offset=offset)

    async def create(self, patient_id: UUID, payload: SessionCreate) -> Session:
        await self._ensure_patient(patient_id)
        next_number = await self._repo.max_session_number(patient_id) + 1
        session_obj = Session(
            patient_id=patient_id,
            session_number=next_number,
            status=SessionStatus.ACTIVE,
            **payload.model_dump(),
        )
        return await self._repo.add(session_obj)

    async def update(
        self, patient_id: UUID, session_id: UUID, payload: SessionUpdate
    ) -> Session:
        session_obj = await self.get_or_404(patient_id, session_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(session_obj, field, value)
        await self._repo.flush()
        return session_obj

    async def set_status(
        self, patient_id: UUID, session_id: UUID, new_status: SessionStatus
    ) -> Session:
        """Transition a session's status.

        A session may move out of ``active`` into any terminal state, but once it
        is terminal (completed/failed/aborted) its status is frozen.
        """

        session_obj = await self.get_or_404(patient_id, session_id)
        if session_obj.status == new_status:
            return session_obj
        if session_obj.status.is_terminal:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"session is already {session_obj.status.value}; "
                    "a finished session cannot change status"
                ),
            )
        session_obj.status = new_status
        await self._repo.flush()
        return session_obj
