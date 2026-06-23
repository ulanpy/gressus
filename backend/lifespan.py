"""FastAPI lifespan: infrastructure setup, router registration, cleanup."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.app_state.runtime import cleanup_runtime_manager, setup_runtime_manager
from backend.core.configs.config import config
from backend.app_state.db import setup_db, cleanup_db
from backend.routers import routers


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.config = config
    await setup_db(app)
    setup_runtime_manager(app, app.state.config)

    for router in routers:
        app.include_router(router)

    try:
        yield
    finally:
        await cleanup_runtime_manager(app)
        await cleanup_db(app)
