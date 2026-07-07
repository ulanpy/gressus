"""Patient use cases and domain rules."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.modules.patients.models import Patient
from backend.modules.patients.repository import PatientRepository
from backend.modules.patients.schemas import PatientCreate, PatientUpdate


class PatientService:
    def __init__(self, session: AsyncSession) -> None:
        self._repo = PatientRepository(session)

    async def get_or_404(self, patient_id: UUID) -> Patient:
        patient = await self._repo.get_by_id(patient_id)
        if patient is None:
            raise HTTPException(status_code=404, detail=f"patient {patient_id} not found")
        return patient

    async def ensure_exists(self, patient_id: UUID) -> None:
        """Satisfies ``PatientReader`` ports in other modules."""

        await self.get_or_404(patient_id)

    async def list(
        self, *, include_archived: bool = False, limit: int = 100, offset: int = 0
    ) -> Sequence[Patient]:
        del limit, offset  # pagination not yet implemented in repository
        return await self._repo.get_all(include_archived=include_archived)

    async def create(self, payload: PatientCreate) -> Patient:
        return await self._repo.create(payload)

    async def update(self, patient_id: UUID, payload: PatientUpdate) -> Patient:
        patient = await self._repo.update(patient_id, payload)
        if patient is None:
            raise HTTPException(status_code=404, detail=f"patient {patient_id} not found")
        return patient

    async def archive(self, patient_id: UUID) -> Patient:
        """Soft-delete: set ``archived_at`` instead of removing the row."""

        patient = await self._repo.archive(patient_id)
        if patient is None:
            raise HTTPException(status_code=404, detail=f"patient {patient_id} not found")
        return patient
