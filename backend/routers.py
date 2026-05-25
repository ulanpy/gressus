"""FastAPI router registry."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter

from backend.modules.health.api import router as health_router
from backend.modules.insole.api import router as insole_router
from backend.modules.insole.api import ws_router as insole_ws_router
from backend.modules.runtime.api import router as runtime_router

routers: List[APIRouter] = [
    health_router,
    insole_router,
    insole_ws_router,
    runtime_router,
]
