"""Patient use cases and domain rules."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.modules.patients.models import Patient
from backend.modules.patients.repository import PatientRepository
from backend.modules.patients.schemas import PatientCreate, PatientUpdate


class PatientService:
    def __init__(self, session: AsyncSession) -> None:
        self._repo = PatientRepository(session)

    async def get_or_404(self, patient_id: int) -> Patient:
        patient = await self._repo.get(patient_id)
        if patient is None:
            raise HTTPException(status_code=404, detail=f"patient {patient_id} not found")
        return patient

    async def list(
        self, *, include_archived: bool = False, limit: int = 100, offset: int = 0
    ) -> Sequence[Patient]:
        return await self._repo.list(
            include_archived=include_archived, limit=limit, offset=offset
        )

    async def create(self, payload: PatientCreate) -> Patient:
        patient = Patient(**payload.model_dump())
        return await self._repo.add(patient)

    async def update(self, patient_id: int, payload: PatientUpdate) -> Patient:
        patient = await self.get_or_404(patient_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(patient, field, value)
        await self._repo.flush()
        return patient

    async def archive(self, patient_id: int) -> Patient:
        """Soft-delete: set ``archived_at`` instead of removing the row."""

        patient = await self.get_or_404(patient_id)
        if patient.archived_at is None:
            patient.archived_at = datetime.now(timezone.utc)
            await self._repo.flush()
        return patient
