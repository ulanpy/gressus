"""Insole HTTP and WebSocket routes."""

from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect

from backend.common.dependencies import get_insole_service
from backend.core.configs.config import config
from backend.modules.insole.schemas import InsoleSize, frame_to_dict
from backend.modules.insole.service import InsoleService

router = APIRouter(prefix="/api", tags=["insole"])
ws_router = APIRouter(tags=["insole"])


@router.get("/geometry")
def geometry(
    service: Annotated[InsoleService, Depends(get_insole_service)],
    size: InsoleSize = Query("m"),
) -> dict:
    return service.geometry(size).model_dump()


@router.get("/frame")
def frame(
    service: Annotated[InsoleService, Depends(get_insole_service)],
    size: InsoleSize = Query("m"),
    threshold_kpa: float = Query(config.INSOLE_THRESHOLD_KPA, ge=0),
) -> dict:
    return frame_to_dict(service.frame(size=size, threshold_kpa=threshold_kpa))


@ws_router.websocket("/ws/insole")
async def insole_ws(
    websocket: WebSocket,
    size: InsoleSize = Query("m"),
    threshold_kpa: float = Query(config.INSOLE_THRESHOLD_KPA, ge=0),
    hz: float = Query(50.0, ge=1.0, le=60.0),
) -> None:
    await websocket.accept()
    service = InsoleService(
        receiver=getattr(websocket.app.state, "insole_receiver", None),
        process_manager=websocket.app.state.process_manager,
        config=websocket.app.state.config,
    )
    delay = 1.0 / hz
    try:
        while True:
            frame = service.frame(size=size, threshold_kpa=threshold_kpa)
            await websocket.send_json(frame_to_dict(frame))
            await asyncio.sleep(delay)
    except WebSocketDisconnect:
        return
    except RuntimeError:
        return
