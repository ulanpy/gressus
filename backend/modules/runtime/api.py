"""Runtime control — session recording and ROS runtime status."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from backend.modules.runtime.dependencies import get_runtime_service
from backend.modules.runtime.schemas import (
    RuntimeSnapshot,
    SessionActionResponse,
    SessionStartRequest,
)
from backend.modules.runtime.service import RuntimeService

router = APIRouter(prefix="/api/runtime", tags=["runtime"])


@router.get("/status", response_model=RuntimeSnapshot)
async def runtime_status(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> RuntimeSnapshot:
    """Poll ROS runtime health: rosbag job, telemetry node, ESP32 UDP link."""
    return await service.snapshot()


@router.post("/session/start", response_model=SessionActionResponse)
async def session_start(
    payload: SessionStartRequest,
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> SessionActionResponse:
    """Open a DB session for the patient and start rosbag recording."""
    anthropometrics = (
        payload.anthropometrics.model_dump(exclude_none=True)
        if payload.anthropometrics is not None
        else None
    )
    return await service.start_session(
        payload.patientId,
        payload.profileJson,
        anthropometrics,
    )


@router.post("/session/stop", response_model=SessionActionResponse)
async def session_stop(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> SessionActionResponse:
    """Close the open session and stop rosbag recording."""
    return await service.stop_session()
