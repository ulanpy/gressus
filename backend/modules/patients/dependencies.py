"""FastAPI dependencies for the patients module."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database.manager import get_db_session
from backend.modules.patients.service import PatientService


def get_patient_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> PatientService:
    return PatientService(session)
