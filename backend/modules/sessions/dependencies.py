"""FastAPI dependencies for the sessions module."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.common.dependencies import get_db_session
from backend.modules.sessions.service import SessionService


def get_session_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> SessionService:
    return SessionService(session)
