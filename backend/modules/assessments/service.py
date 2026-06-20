"""Assessment use cases and domain rules."""

from __future__ import annotations

from collections.abc import Sequence

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.modules.assessments.models import (
    Assessment,
    AssessmentBody,
    AssessmentObservations,
    AssessmentSpatialGait,
    AssessmentWalkingTests,
)
from backend.modules.assessments.repository import AssessmentRepository
from backend.modules.assessments.schemas import (
    AssessmentCreate,
    AssessmentUpdate,
    BodyData,
    ObservationsData,
    SpatialGaitData,
    WalkingTestsData,
)
from backend.modules.patients.repository import PatientRepository


class AssessmentService:
    def __init__(self, session: AsyncSession) -> None:
        self._repo = AssessmentRepository(session)
        self._patients = PatientRepository(session)

    async def _ensure_patient(self, patient_id: int) -> None:
        patient = await self._patients.get(patient_id)
        if patient is None:
            raise HTTPException(status_code=404, detail=f"patient {patient_id} not found")

    async def get_or_404(self, patient_id: int, assessment_id: int) -> Assessment:
        assessment = await self._repo.get(assessment_id)
        if assessment is None or assessment.patient_id != patient_id:
            raise HTTPException(
                status_code=404,
                detail=f"assessment {assessment_id} not found for patient {patient_id}",
            )
        return assessment

    async def list_for_patient(
        self, patient_id: int, *, limit: int = 100, offset: int = 0
    ) -> Sequence[Assessment]:
        await self._ensure_patient(patient_id)
        return await self._repo.list_for_patient(patient_id, limit=limit, offset=offset)

    async def create(self, patient_id: int, payload: AssessmentCreate) -> Assessment:
        await self._ensure_patient(patient_id)
        next_number = await self._repo.max_assessment_number(patient_id) + 1
        assessment = Assessment(
            patient_id=patient_id,
            assessment_number=next_number,
            assessment_date=payload.assessment_date,
            assessment_type=payload.assessment_type,
        )
        if payload.body is not None:
            assessment.body = AssessmentBody(**payload.body.model_dump())
        if payload.spatial_gait is not None:
            assessment.spatial_gait = AssessmentSpatialGait(
                **payload.spatial_gait.model_dump()
            )
        if payload.walking_tests is not None:
            assessment.walking_tests = AssessmentWalkingTests(
                **payload.walking_tests.model_dump()
            )
        if payload.observations is not None:
            assessment.observations = AssessmentObservations(
                **payload.observations.model_dump()
            )
        return await self._repo.add(assessment)

    async def update(
        self, patient_id: int, assessment_id: int, payload: AssessmentUpdate
    ) -> Assessment:
        assessment = await self.get_or_404(patient_id, assessment_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(assessment, field, value)
        await self._repo.flush()
        return assessment

    # --- detail blocks: upsert one 1:1 child at a time -------------------------

    async def set_body(
        self, patient_id: int, assessment_id: int, data: BodyData
    ) -> Assessment:
        assessment = await self.get_or_404(patient_id, assessment_id)
        if assessment.body is None:
            assessment.body = AssessmentBody(**data.model_dump())
        else:
            for field, value in data.model_dump().items():
                setattr(assessment.body, field, value)
        await self._repo.flush()
        return await self.get_or_404(patient_id, assessment_id)

    async def set_spatial_gait(
        self, patient_id: int, assessment_id: int, data: SpatialGaitData
    ) -> Assessment:
        assessment = await self.get_or_404(patient_id, assessment_id)
        if assessment.spatial_gait is None:
            assessment.spatial_gait = AssessmentSpatialGait(**data.model_dump())
        else:
            for field, value in data.model_dump().items():
                setattr(assessment.spatial_gait, field, value)
        await self._repo.flush()
        return await self.get_or_404(patient_id, assessment_id)

    async def set_walking_tests(
        self, patient_id: int, assessment_id: int, data: WalkingTestsData
    ) -> Assessment:
        assessment = await self.get_or_404(patient_id, assessment_id)
        if assessment.walking_tests is None:
            assessment.walking_tests = AssessmentWalkingTests(**data.model_dump())
        else:
            for field, value in data.model_dump().items():
                setattr(assessment.walking_tests, field, value)
        await self._repo.flush()
        return await self.get_or_404(patient_id, assessment_id)

    async def set_observations(
        self, patient_id: int, assessment_id: int, data: ObservationsData
    ) -> Assessment:
        assessment = await self.get_or_404(patient_id, assessment_id)
        if assessment.observations is None:
            assessment.observations = AssessmentObservations(**data.model_dump())
        else:
            for field, value in data.model_dump().items():
                setattr(assessment.observations, field, value)
        await self._repo.flush()
        return await self.get_or_404(patient_id, assessment_id)
