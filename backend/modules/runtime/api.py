"""Runtime control — ROS stack lifecycle and P.GEAR exoskeleton commands."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from backend.common.dependencies import get_runtime_service
from backend.modules.runtime.schemas import (
    LoadPgearProfileRequest,
    PgearCommandResponse,
    RuntimeSnapshot,
    StackStartResponse,
    StackStopResponse,
    StartStackRequest,
    StopStackRequest,
)
from backend.modules.runtime.service import RuntimeService

router = APIRouter(prefix="/api/runtime", tags=["runtime"])


@router.get("/status", response_model=RuntimeSnapshot)
async def runtime_status(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> RuntimeSnapshot:
    """Poll whether a ROS stack is running (Control panel, ~1.5 s interval)."""
    return await service.snapshot()


@router.post("/stack/start", response_model=StackStartResponse)
async def stack_start(
    payload: StartStackRequest,
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> StackStartResponse:
    """Launch a ROS stack.

    ``job``: ``feedback`` (clinical), ``game`` (projector tiles), or ``calibrate_apriltag``.
    Pass ``sessionId`` + ``patientId`` to tie the run to a DB session and ROS data dir.
    """
    return await service.start_stack(payload)


@router.post("/stack/stop", response_model=StackStopResponse)
async def stack_stop(
    payload: StopStackRequest,
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> StackStopResponse:
    """Stop the active launch job. ``timeoutS`` — grace period before force kill."""
    return await service.stop_stack(payload)


@router.post("/start", response_model=StackStartResponse)
async def runtime_start_legacy(
    payload: StartStackRequest,
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> StackStartResponse:
    """Same as ``POST /stack/start`` — kept for existing Control UI."""
    return await service.start_stack(payload)


@router.post("/stop", response_model=StackStopResponse)
async def runtime_stop_legacy(
    payload: StopStackRequest,
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> StackStopResponse:
    """Same as ``POST /stack/stop`` — kept for existing Control UI."""
    return await service.stop_stack(payload)


@router.post("/pgear/load-profile", response_model=PgearCommandResponse)
async def pgear_load_profile(
    payload: LoadPgearProfileRequest,
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> PgearCommandResponse:
    """Apply exo profile JSON to the device. Stack with ``pgear_device_node`` must be up."""
    return await service.pgear_load_profile(payload.profileJson)


@router.post("/pgear/arm", response_model=PgearCommandResponse)
async def pgear_arm(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> PgearCommandResponse:
    """Enable motors, hold position."""
    return await service.pgear_arm()


@router.post("/pgear/disarm", response_model=PgearCommandResponse)
async def pgear_disarm(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> PgearCommandResponse:
    """Disable motors, safe idle."""
    return await service.pgear_disarm()


@router.post("/pgear/run", response_model=PgearCommandResponse)
async def pgear_run(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> PgearCommandResponse:
    """Start assisted gait."""
    return await service.pgear_run()


@router.post("/pgear/stop-gait", response_model=PgearCommandResponse)
async def pgear_stop_gait(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> PgearCommandResponse:
    """Stop gait, stay armed."""
    return await service.pgear_stop_gait()


@router.post("/pgear/estop", response_model=PgearCommandResponse)
async def pgear_estop(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> PgearCommandResponse:
    """Emergency stop on the device."""
    return await service.pgear_estop()
