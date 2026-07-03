"""Assessment use cases and domain rules."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.modules.assessments.models import Assessment
from backend.modules.assessments.repository import AssessmentRepository
from backend.modules.assessments.schemas import AssessmentCreate, AssessmentUpdate
from backend.modules.patients.repository import PatientRepository


class AssessmentService:
    def __init__(self, session: AsyncSession) -> None:
        self._repo = AssessmentRepository(session)
        self._patients = PatientRepository(session)

    async def _ensure_patient(self, patient_id: UUID) -> None:
        patient = await self._patients.get_by_id(patient_id)
        if patient is None:
            raise HTTPException(status_code=404, detail=f"patient {patient_id} not found")

    async def get_or_404(self, patient_id: UUID, assessment_id: UUID) -> Assessment:
        assessment = await self._repo.get(assessment_id)
        if assessment is None or assessment.patient_id != patient_id:
            raise HTTPException(
                status_code=404,
                detail=f"assessment {assessment_id} not found for patient {patient_id}",
            )
        return assessment

    async def list_for_patient(
        self, patient_id: UUID, *, limit: int = 100, offset: int = 0
    ) -> Sequence[Assessment]:
        await self._ensure_patient(patient_id)
        return await self._repo.list_for_patient(patient_id, limit=limit, offset=offset)

    async def create(self, patient_id: UUID, payload: AssessmentCreate) -> Assessment:
        await self._ensure_patient(patient_id)
        next_number = await self._repo.max_assessment_number(patient_id) + 1
        assessment = Assessment(
            patient_id=patient_id,
            assessment_number=next_number,
            assessment_date=payload.assessment_date,
            assessment_type=payload.assessment_type,
            assessor=payload.assessor,
            form_data=payload.form_data,
        )
        return await self._repo.add(assessment)

    async def update(
        self, patient_id: UUID, assessment_id: UUID, payload: AssessmentUpdate
    ) -> Assessment:
        assessment = await self.get_or_404(patient_id, assessment_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(assessment, field, value)
        await self._repo.flush()
        return assessment