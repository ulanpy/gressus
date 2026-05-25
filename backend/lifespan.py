"""FastAPI lifespan: infrastructure setup, router registration, cleanup."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.app_state.insole import cleanup_insole_receiver, setup_insole_receiver
from backend.app_state.runtime import cleanup_runtime_manager, setup_runtime_manager
from backend.core.configs.config import config
from backend.routers import routers


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.config = config
    setup_insole_receiver(app, app.state.config)
    setup_runtime_manager(app, app.state.config)

    for router in routers:
        app.include_router(router)

    try:
        yield
    finally:
        cleanup_runtime_manager(app)
        cleanup_insole_receiver(app)
