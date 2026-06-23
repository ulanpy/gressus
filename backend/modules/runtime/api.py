"""Runtime control routes — stack lifecycle and P.GEAR device commands."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from backend.common.dependencies import get_runtime_service
from backend.modules.runtime.schemas import (
    LoadPgearProfileRequest,
    PgearCommandResponse,
    StartStackRequest,
    StopStackRequest,
)
from backend.modules.runtime.service import RuntimeService

router = APIRouter(prefix="/api/runtime", tags=["runtime"])


@router.get("/status")
async def runtime_status(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> dict:
    return await service.snapshot()


@router.post("/stack/start")
async def stack_start(
    payload: StartStackRequest,
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> dict:
    """Start a ROS launch stack (``feedback`` clinical pipeline or legacy ``game`` / calibrate)."""
    return await service.start_stack(payload)


@router.post("/stack/stop")
async def stack_stop(
    payload: StopStackRequest,
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> dict:
    return await service.stop_stack(payload)


# Legacy projector-game routes (frontend still uses these).
@router.post("/start")
async def runtime_start_legacy(
    payload: StartStackRequest,
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> dict:
    return await service.start_stack(payload)


@router.post("/stop")
async def runtime_stop_legacy(
    payload: StopStackRequest,
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> dict:
    return await service.stop_stack(payload)


@router.post("/pgear/load-profile", response_model=PgearCommandResponse)
async def pgear_load_profile(
    payload: LoadPgearProfileRequest,
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> dict:
    return await service.pgear_load_profile(payload.profileJson)


@router.post("/pgear/arm", response_model=PgearCommandResponse)
async def pgear_arm(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> dict:
    return await service.pgear_arm()


@router.post("/pgear/disarm", response_model=PgearCommandResponse)
async def pgear_disarm(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> dict:
    return await service.pgear_disarm()


@router.post("/pgear/run", response_model=PgearCommandResponse)
async def pgear_run(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> dict:
    return await service.pgear_run()


@router.post("/pgear/stop-gait", response_model=PgearCommandResponse)
async def pgear_stop_gait(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> dict:
    return await service.pgear_stop_gait()


@router.post("/pgear/estop", response_model=PgearCommandResponse)
async def pgear_estop(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> dict:
    return await service.pgear_estop()
