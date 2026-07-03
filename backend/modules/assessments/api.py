"""Clinical assessments — Pre-Assessment Form stored as one JSON document."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from backend.modules.assessments.dependencies import get_assessment_service
from backend.modules.assessments.schemas import (
    AssessmentCreate,
    AssessmentRead,
    AssessmentUpdate,
)
from backend.modules.assessments.service import AssessmentService

router = APIRouter(prefix="/api/patients/{patient_id}/assessments", tags=["assessments"])


@router.get("", response_model=list[AssessmentRead])
async def list_assessments(
    patient_id: UUID,
    service: Annotated[AssessmentService, Depends(get_assessment_service)],
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[AssessmentRead]:
    items = await service.list_for_patient(patient_id, limit=limit, offset=offset)
    return [AssessmentRead.model_validate(a) for a in items]


@router.post("", response_model=AssessmentRead, status_code=status.HTTP_201_CREATED)
async def create_assessment(
    patient_id: UUID,
    payload: AssessmentCreate,
    service: Annotated[AssessmentService, Depends(get_assessment_service)],
) -> AssessmentRead:
    assessment = await service.create(patient_id, payload)
    return AssessmentRead.model_validate(assessment)


@router.get("/{assessment_id}", response_model=AssessmentRead)
async def get_assessment(
    patient_id: UUID,
    assessment_id: UUID,
    service: Annotated[AssessmentService, Depends(get_assessment_service)],
) -> AssessmentRead:
    assessment = await service.get_or_404(patient_id, assessment_id)
    return AssessmentRead.model_validate(assessment)


@router.patch("/{assessment_id}", response_model=AssessmentRead)
async def update_assessment(
    patient_id: UUID,
    assessment_id: UUID,
    payload: AssessmentUpdate,
    service: Annotated[AssessmentService, Depends(get_assessment_service)],
) -> AssessmentRead:
    assessment = await service.update(patient_id, assessment_id, payload)
    return AssessmentRead.model_validate(assessment)