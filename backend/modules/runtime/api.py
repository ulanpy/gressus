"""Runtime control routes (game/calibration via session manager)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from backend.common.dependencies import get_runtime_service
from backend.modules.runtime.schemas import StartRuntimeRequest, StopRuntimeRequest
from backend.modules.runtime.service import RuntimeService

router = APIRouter(prefix="/api/runtime", tags=["runtime"])


@router.get("/status")
def runtime_status(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> dict:
    return service.snapshot()


@router.post("/start")
def runtime_start(
    payload: StartRuntimeRequest,
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> dict:
    return service.start(payload)


@router.post("/stop")
def runtime_stop(
    payload: StopRuntimeRequest,
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> dict:
    return service.stop(payload.timeoutS)
