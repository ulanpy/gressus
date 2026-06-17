"""FastAPI dependencies for the patients module."""

from __future__ import annotations

from backend.common.dependencies import get_db_session
from backend.modules.patients.service import PatientService
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession


def get_patient_service(
    db_session: AsyncSession = Depends(get_db_session),
) -> PatientService:
    return PatientService(db_session)
