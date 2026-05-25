"""Runtime control routes (game/calibration subprocesses)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

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


@router.get("/log")
def runtime_log(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
    tail: int = Query(4096, ge=128, le=65536),
) -> dict:
    return service.log_tail(tail)
