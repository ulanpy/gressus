"""Read the currently recording session independently of patient selection."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from backend.modules.sessions.dependencies import get_session_service
from backend.modules.sessions.recording_sources import inspect_session_sources
from backend.modules.sessions.schemas import SessionRead
from backend.modules.sessions.service import SessionService

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("/active", response_model=SessionRead)
async def get_active_recording_session(
    service: Annotated[SessionService, Depends(get_session_service)],
) -> SessionRead:
    """Return the recording session even when no patient is selected in the UI."""

    session_obj = await service.get_open_recording_session()
    if session_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="no recording session is active",
        )
    payload = SessionRead.model_validate(session_obj)
    return payload.model_copy(update={"recording_sources": inspect_session_sources(session_obj)})
