"""Insole HTTP routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from backend.common.dependencies import get_insole_service
from backend.modules.insole.schemas import InsoleSize
from backend.modules.insole.service import InsoleService

router = APIRouter(prefix="/api", tags=["insole"])


@router.get("/geometry")
def geometry(
    service: Annotated[InsoleService, Depends(get_insole_service)],
    size: InsoleSize = Query("m"),
) -> dict:
    return service.geometry(size).model_dump()
