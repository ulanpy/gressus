"""Patient HTTP routes."""

from __future__ import annotations

import uuid
from typing import Annotated

from backend.modules.patients import dependencies as deps, schemas
from backend.modules.patients.service import PatientService
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.get("", response_model=list[PatientRead])
async def list_patients(
    service: Annotated[PatientService, Depends(get_patient_service)],
    include_archived: bool = Query(False),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[PatientRead]:
    patients = await service.list(
        include_archived=include_archived, limit=limit, offset=offset
    )
    return [PatientRead.model_validate(p) for p in patients]


@router.post("", response_model=PatientRead, status_code=status.HTTP_201_CREATED)
async def create_patient(
    payload: PatientCreate,
    service: Annotated[PatientService, Depends(get_patient_service)],
) -> PatientRead:
    patient = await service.create(payload)
    return PatientRead.model_validate(patient)


@router.get("/{patient_id}", response_model=PatientRead)
async def get_patient(
    patient_id: int,
    service: Annotated[PatientService, Depends(get_patient_service)],
) -> PatientRead:
    patient = await service.get_or_404(patient_id)
    return PatientRead.model_validate(patient)


@router.patch("/{patient_id}", response_model=PatientRead)
async def update_patient(
    patient_id: int,
    payload: PatientUpdate,
    service: Annotated[PatientService, Depends(get_patient_service)],
) -> PatientRead:
    patient = await service.update(patient_id, payload)
    return PatientRead.model_validate(patient)


@router.delete("/{patient_id}", response_model=PatientRead)
async def archive_patient(
    patient_id: int,
    service: Annotated[PatientService, Depends(get_patient_service)],
) -> PatientRead:
    """Soft-delete (archive) a patient."""

    patient = await service.archive(patient_id)
    return PatientRead.model_validate(patient)
