"""Session data access (SQLAlchemy 2.0, no commits here)."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.modules.sessions.enums import AnalyticsStatus, SessionStatus
from backend.modules.sessions.models import Session


class SessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, session_id: UUID) -> Session | None:
        return await self._session.get(Session, session_id)

    async def list_for_patient(
        self, patient_id: UUID, *, limit: int = 100, offset: int = 0
    ) -> Sequence[Session]:
        stmt = (
            select(Session)
            .where(Session.patient_id == patient_id)
            # UUID PKs are not chronologically ordered, so tie-break on created_at.
            .order_by(Session.session_number, Session.created_at)
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def max_session_number(self, patient_id: UUID) -> int:
        stmt = select(func.coalesce(func.max(Session.session_number), 0)).where(
            Session.patient_id == patient_id
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def add(self, session_obj: Session) -> Session:
        self._session.add(session_obj)
        await self._session.flush()
        await self._session.refresh(session_obj)
        return session_obj

    async def flush(self) -> None:
        await self._session.flush()

    async def claim_next_for_analytics(self) -> Session | None:
        """Lock the oldest session that still needs analytics processing."""

        terminal = (
            SessionStatus.COMPLETED,
            SessionStatus.FAILED,
            SessionStatus.ABORTED,
        )
        stmt = (
            select(Session)
            .where(
                Session.status.in_(terminal),
                or_(
                    Session.analytics_status == AnalyticsStatus.PENDING,
                    Session.analytics_status.is_(None),
                ),
            )
            .order_by(Session.ended_at.asc().nulls_last(), Session.created_at.asc())
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        result = await self._session.execute(stmt)
        session_obj = result.scalars().first()
        if session_obj is None:
            return None
        session_obj.analytics_status = AnalyticsStatus.PROCESSING
        await self._session.flush()
        return session_obj
