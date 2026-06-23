"""Health and diagnostics routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from backend.common.dependencies import get_config, get_runtime_service
from backend.core.configs.config import Config
from backend.modules.runtime.service import RuntimeService

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health(
    cfg: Annotated[Config, Depends(get_config)],
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> dict:
    return {
        "ok": True,
        "insoleWsUrl": cfg.INSOLE_WS_URL,
        "runtime": await service.snapshot(),
    }
