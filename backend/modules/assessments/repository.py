"""Assessment data access (SQLAlchemy 2.0, no commits here)."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.modules.assessments.models import Assessment


class AssessmentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, assessment_id: UUID) -> Assessment | None:
        stmt = select(Assessment).where(Assessment.id == assessment_id)
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def list_for_patient(
        self, patient_id: UUID, *, limit: int = 100, offset: int = 0
    ) -> Sequence[Assessment]:
        stmt = (
            select(Assessment)
            .where(Assessment.patient_id == patient_id)
            .order_by(Assessment.assessment_number, Assessment.id)
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def max_assessment_number(self, patient_id: UUID) -> int:
        stmt = select(
            func.coalesce(func.max(Assessment.assessment_number), 0)
        ).where(Assessment.patient_id == patient_id)
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def add(self, assessment: Assessment) -> Assessment:
        self._session.add(assessment)
        await self._session.flush()
        return assessment

    async def flush(self) -> None:
        await self._session.flush()