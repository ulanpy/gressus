"""FastAPI dependencies for the assessments module."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.common.dependencies import get_db_session
from backend.modules.assessments.service import AssessmentService
from backend.modules.patients.dependencies import get_patient_service
from backend.modules.patients.service import PatientService


def get_assessment_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    patients: Annotated[PatientService, Depends(get_patient_service)],
) -> AssessmentService:
    return AssessmentService(session, patients)
