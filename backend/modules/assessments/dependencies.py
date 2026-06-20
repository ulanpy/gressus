"""FastAPI dependencies for the assessments module."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database.manager import get_db_session
from backend.modules.assessments.service import AssessmentService


def get_assessment_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AssessmentService:
    return AssessmentService(session)
