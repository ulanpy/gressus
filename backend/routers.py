"""FastAPI router registry."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter

from backend.modules.health.api import router as health_router
from backend.modules.insole.api import router as insole_router
from backend.modules.patients.api import router as patients_router
from backend.modules.runtime.api import router as runtime_router
from backend.modules.sessions.api import router as sessions_router

routers: List[APIRouter] = [
    health_router,
    insole_router,
    patients_router,
    runtime_router,
    sessions_router,
]
