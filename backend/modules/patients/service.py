"""Patient use cases."""

from __future__ import annotations

import uuid

from backend.modules.patients import repository, schemas
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession


class PatientService:
    def __init__(self, db_session: AsyncSession) -> None:
        self._repository = repository.PatientRepository(db_session)

    async def create_patient(self, data: schemas.PatientCreate) -> schemas.PatientRead:
        patient = await self._repository.create(data)
        return schemas.PatientRead.model_validate(patient)

    async def list_patients(self, *, include_archived: bool = False) -> list[schemas.PatientRead]:
        patients = await self._repository.get_all(include_archived=include_archived)
        return [schemas.PatientRead.model_validate(patient) for patient in patients]

    async def get_patient(self, patient_id: uuid.UUID) -> schemas.PatientRead:
        patient = await self._repository.get_by_id(patient_id)
        if patient is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found",
            )
        return schemas.PatientRead.model_validate(patient)

    async def update_patient(
        self,
        patient_id: uuid.UUID,
        data: schemas.PatientUpdate,
    ) -> schemas.PatientRead:
        patient = await self._repository.get_by_id(patient_id)
        if patient is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found",
            )
        if patient.archived_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot update archived patient",
            )

        updated = await self._repository.update(patient_id, data)
        assert updated is not None
        return schemas.PatientRead.model_validate(updated)

    async def archive_patient(self, patient_id: uuid.UUID) -> schemas.PatientRead:
        patient = await self._repository.get_by_id(patient_id)
        if patient is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found",
            )
        if patient.archived_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Patient is already archived",
            )

        archived = await self._repository.archive(patient_id)
        assert archived is not None
        return schemas.PatientRead.model_validate(archived)
