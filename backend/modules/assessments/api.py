"""Clinical assessments — intake forms split into saveable blocks."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from backend.modules.assessments.dependencies import get_assessment_service
from backend.modules.assessments.schemas import (
    AssessmentCreate,
    AssessmentRead,
    AssessmentUpdate,
    BodyData,
    ObservationsData,
    SpatialGaitData,
    WalkingTestsData,
)
from backend.modules.assessments.service import AssessmentService

router = APIRouter(
    prefix="/api/patients/{patient_id}/assessments", tags=["assessments"]
)


@router.get("", response_model=list[AssessmentRead])
async def list_assessments(
    patient_id: UUID,
    service: Annotated[AssessmentService, Depends(get_assessment_service)],
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[AssessmentRead]:
    """All assessments for a patient."""
    items = await service.list_for_patient(patient_id, limit=limit, offset=offset)
    return [AssessmentRead.model_validate(a) for a in items]


@router.post("", response_model=AssessmentRead, status_code=status.HTTP_201_CREATED)
async def create_assessment(
    patient_id: UUID,
    payload: AssessmentCreate,
    service: Annotated[AssessmentService, Depends(get_assessment_service)],
) -> AssessmentRead:
    """New assessment; optional blocks can be sent in the same body."""
    assessment = await service.create(patient_id, payload)
    return AssessmentRead.model_validate(assessment)


@router.get("/{assessment_id}", response_model=AssessmentRead)
async def get_assessment(
    patient_id: UUID,
    assessment_id: UUID,
    service: Annotated[AssessmentService, Depends(get_assessment_service)],
) -> AssessmentRead:
    """Full form including body, gait, tests, observations."""
    assessment = await service.get_or_404(patient_id, assessment_id)
    return AssessmentRead.model_validate(assessment)


@router.patch("/{assessment_id}", response_model=AssessmentRead)
async def update_assessment(
    patient_id: UUID,
    assessment_id: UUID,
    payload: AssessmentUpdate,
    service: Annotated[AssessmentService, Depends(get_assessment_service)],
) -> AssessmentRead:
    """Patch header fields only; use PUT routes below for whole blocks."""
    assessment = await service.update(patient_id, assessment_id, payload)
    return AssessmentRead.model_validate(assessment)


@router.put("/{assessment_id}/body", response_model=AssessmentRead)
async def set_body(
    patient_id: UUID,
    assessment_id: UUID,
    payload: BodyData,
    service: Annotated[AssessmentService, Depends(get_assessment_service)],
) -> AssessmentRead:
    """Save anthropometrics / ROM block."""
    assessment = await service.set_body(patient_id, assessment_id, payload)
    return AssessmentRead.model_validate(assessment)


@router.put("/{assessment_id}/spatial-gait", response_model=AssessmentRead)
async def set_spatial_gait(
    patient_id: UUID,
    assessment_id: UUID,
    payload: SpatialGaitData,
    service: Annotated[AssessmentService, Depends(get_assessment_service)],
) -> AssessmentRead:
    """Save spatial–temporal gait block."""
    assessment = await service.set_spatial_gait(patient_id, assessment_id, payload)
    return AssessmentRead.model_validate(assessment)


@router.put("/{assessment_id}/walking-tests", response_model=AssessmentRead)
async def set_walking_tests(
    patient_id: UUID,
    assessment_id: UUID,
    payload: WalkingTestsData,
    service: Annotated[AssessmentService, Depends(get_assessment_service)],
) -> AssessmentRead:
    """Save walking tests (6MWT, 10 m, etc.)."""
    assessment = await service.set_walking_tests(patient_id, assessment_id, payload)
    return AssessmentRead.model_validate(assessment)


@router.put("/{assessment_id}/observations", response_model=AssessmentRead)
async def set_observations(
    patient_id: UUID,
    assessment_id: UUID,
    payload: ObservationsData,
    service: Annotated[AssessmentService, Depends(get_assessment_service)],
) -> AssessmentRead:
    """Save therapist notes and observations."""
    assessment = await service.set_observations(patient_id, assessment_id, payload)
    return AssessmentRead.model_validate(assessment)
