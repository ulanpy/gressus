"""Therapy sessions for a patient — workflow before/during ROS runs."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from backend.modules.sessions.dependencies import get_session_service
from backend.modules.sessions.schemas import (
    EpisodeSelectionUpdate,
    SessionCreate,
    SessionRead,
    SessionStatusUpdate,
    SessionUpdate,
)
from backend.modules.sessions.service import SessionService

router = APIRouter(prefix="/api/patients/{patient_id}/sessions", tags=["sessions"])


@router.get("", response_model=list[SessionRead])
async def list_sessions(
    patient_id: UUID,
    service: Annotated[SessionService, Depends(get_session_service)],
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[SessionRead]:
    """Session history for the selected patient."""
    sessions = await service.list_for_patient(patient_id, limit=limit, offset=offset)
    return [SessionRead.model_validate(s) for s in sessions]


@router.post("", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
async def create_session(
    patient_id: UUID,
    payload: SessionCreate,
    service: Annotated[SessionService, Depends(get_session_service)],
) -> SessionRead:
    """Open a session (``status=active``, auto ``session_number``)."""
    session_obj = await service.create(patient_id, payload)
    return SessionRead.model_validate(session_obj)


@router.get("/{session_id}", response_model=SessionRead)
async def get_session(
    patient_id: UUID,
    session_id: UUID,
    service: Annotated[SessionService, Depends(get_session_service)],
) -> SessionRead:
    """One session; 404 if it does not belong to this patient."""
    session_obj = await service.get_or_404(patient_id, session_id)
    return SessionRead.model_validate(session_obj)


@router.patch("/{session_id}", response_model=SessionRead)
async def update_session(
    patient_id: UUID,
    session_id: UUID,
    payload: SessionUpdate,
    service: Annotated[SessionService, Depends(get_session_service)],
) -> SessionRead:
    """Edit metadata (date, baselines, calibration flags). Not for status changes."""
    session_obj = await service.update(patient_id, session_id, payload)
    return SessionRead.model_validate(session_obj)


@router.patch("/{session_id}/status", response_model=SessionRead)
async def set_session_status(
    patient_id: UUID,
    session_id: UUID,
    payload: SessionStatusUpdate,
    service: Annotated[SessionService, Depends(get_session_service)],
) -> SessionRead:
    """Finish or abort: ``completed``, ``failed``, ``aborted``, or reopen ``active``."""
    session_obj = await service.set_status(patient_id, session_id, payload.status)
    return SessionRead.model_validate(session_obj)


@router.patch("/{session_id}/analytics/episodes", response_model=SessionRead)
async def update_episode_selection(
    patient_id: UUID,
    session_id: UUID,
    payload: EpisodeSelectionUpdate,
    service: Annotated[SessionService, Depends(get_session_service)],
) -> SessionRead:
    """Exclude episodes and recalculate the whole-session aggregate."""
    session_obj = await service.update_episode_selection(
        patient_id,
        session_id,
        payload.excluded_episode_indices,
    )
    return SessionRead.model_validate(session_obj)
