"""FastAPI dependencies for the sessions module."""

from __future__ import annotations

from backend.common.dependencies import get_db_session
from backend.modules.sessions.service import SessionService
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession


def get_session_service(
    db_session: AsyncSession = Depends(get_db_session),
) -> SessionService:
    return SessionService(db_session)
