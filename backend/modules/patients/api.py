"""Patient HTTP routes."""

from __future__ import annotations

import uuid
from typing import Annotated

from backend.modules.patients import dependencies as deps, schemas
from backend.modules.patients.service import PatientService
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.get("", response_model=list[schemas.PatientRead])
async def list_patients(
    service: Annotated[PatientService, Depends(deps.get_patient_service)],
    include_archived: bool = Query(default=False),
) -> list[schemas.PatientRead]:
    return await service.list_patients(include_archived=include_archived)


@router.post("", response_model=schemas.PatientRead, status_code=201)
async def create_patient(
    payload: schemas.PatientCreate,
    service: Annotated[PatientService, Depends(deps.get_patient_service)],
) -> schemas.PatientRead:
    return await service.create_patient(payload)


@router.get("/{patient_id}", response_model=schemas.PatientRead)
async def get_patient(
    patient_id: uuid.UUID,
    service: Annotated[PatientService, Depends(deps.get_patient_service)],
) -> schemas.PatientRead:
    return await service.get_patient(patient_id)


@router.patch("/{patient_id}", response_model=schemas.PatientRead)
async def update_patient(
    patient_id: uuid.UUID,
    payload: schemas.PatientUpdate,
    service: Annotated[PatientService, Depends(deps.get_patient_service)],
) -> schemas.PatientRead:
    return await service.update_patient(patient_id, payload)


@router.delete("/{patient_id}", response_model=schemas.PatientRead)
async def archive_patient(
    patient_id: uuid.UUID,
    service: Annotated[PatientService, Depends(deps.get_patient_service)],
) -> schemas.PatientRead:
    return await service.archive_patient(patient_id)
