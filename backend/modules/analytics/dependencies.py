"""Composition root for the analytics worker."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from backend.modules.analytics.service import AnalyticsWorkerService
from backend.modules.patients.service import PatientService
from backend.modules.sessions.service import SessionService


def build_analytics_worker_service(db: AsyncSession) -> AnalyticsWorkerService:
    patients = PatientService(db)
    sessions = SessionService(db, patients)
    return AnalyticsWorkerService(db, sessions)
