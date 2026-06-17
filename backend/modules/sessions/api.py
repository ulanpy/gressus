"""Session HTTP routes."""

from __future__ import annotations

import uuid
from typing import Annotated

from backend.modules.sessions import dependencies as deps, schemas
from backend.modules.sessions.service import SessionService
from fastapi import APIRouter, Depends

router = APIRouter(tags=["sessions"])


@router.get(
    "/api/patients/{patient_id}/sessions",
    response_model=list[schemas.SessionRead],
)
async def list_patient_sessions(
    patient_id: uuid.UUID,
    service: Annotated[SessionService, Depends(deps.get_session_service)],
) -> list[schemas.SessionRead]:
    return await service.list_sessions_for_patient(patient_id)


@router.post(
    "/api/patients/{patient_id}/sessions",
    response_model=schemas.SessionRead,
    status_code=201,
)
async def create_patient_session(
    patient_id: uuid.UUID,
    payload: schemas.SessionCreateBody,
    service: Annotated[SessionService, Depends(deps.get_session_service)],
) -> schemas.SessionRead:
    return await service.create_session(patient_id, payload)


@router.get("/api/sessions/{session_id}", response_model=schemas.SessionRead)
async def get_session(
    session_id: uuid.UUID,
    service: Annotated[SessionService, Depends(deps.get_session_service)],
) -> schemas.SessionRead:
    return await service.get_session(session_id)


@router.patch("/api/sessions/{session_id}", response_model=schemas.SessionRead)
async def update_session(
    session_id: uuid.UUID,
    payload: schemas.SessionUpdate,
    service: Annotated[SessionService, Depends(deps.get_session_service)],
) -> schemas.SessionRead:
    return await service.update_session(session_id, payload)
