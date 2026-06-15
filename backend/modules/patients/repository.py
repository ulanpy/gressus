from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.modules.patients.models import Patient
from backend.modules.patients.schemas import PatientCreate, PatientUpdate


class PatientRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, data: PatientCreate) -> Patient:
        patient = Patient(**data.model_dump())
        self._session.add(patient)
        await self._session.flush()
        await self._session.refresh(patient)
        return patient

    async def get_by_id(self, patient_id: uuid.UUID) -> Patient | None:
        result = await self._session.execute(
            select(Patient).where(Patient.id == patient_id)
        )
        return result.scalars().first()

    async def get_all(self, include_archived: bool = False) -> list[Patient]:
        query = select(Patient)
        if not include_archived:
            query = query.where(Patient.archived_at.is_(None))
        query = query.order_by(Patient.created_at.desc())
        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def update(self, patient_id: uuid.UUID, data: PatientUpdate) -> Patient | None:
        patient = await self.get_by_id(patient_id)
        if patient is None:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(patient, field, value)
        await self._session.flush()
        await self._session.refresh(patient)
        return patient

    async def archive(self, patient_id: uuid.UUID) -> Patient | None:
        patient = await self.get_by_id(patient_id)
        if patient is None:
            return None
        patient.archived_at = datetime.utcnow()
        await self._session.flush()
        await self._session.refresh(patient)
        return patient