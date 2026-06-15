from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.modules.sessions.models import Session
from backend.modules.sessions.schemas import SessionCreate, SessionUpdate


class SessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _next_session_number(self, patient_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.coalesce(func.max(Session.session_number), 0)).where(
                Session.patient_id == patient_id
            )
        )
        return result.scalar() + 1

    async def create(self, data: SessionCreate) -> Session:
        session_number = await self._next_session_number(data.patient_id)
        session = Session(
            **data.model_dump(),
            session_number=session_number,
            status="active",
        )
        self._session.add(session)
        await self._session.flush()
        await self._session.refresh(session)
        return session

    async def get_by_id(self, session_id: uuid.UUID) -> Session | None:
        result = await self._session.execute(
            select(Session).where(Session.id == session_id)
        )
        return result.scalars().first()

    async def get_by_patient(self, patient_id: uuid.UUID) -> list[Session]:
        result = await self._session.execute(
            select(Session)
            .where(Session.patient_id == patient_id)
            .order_by(Session.started_at.desc())
        )
        return list(result.scalars().all())

    async def update(self, session_id: uuid.UUID, data: SessionUpdate) -> Session | None:
        session = await self.get_by_id(session_id)
        if session is None:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(session, field, value)
        await self._session.flush()
        await self._session.refresh(session)
        return session