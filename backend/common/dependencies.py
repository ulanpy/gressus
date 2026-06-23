"""Shared FastAPI dependencies."""

from __future__ import annotations

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.configs.config import Config
from backend.core.database import db_manager
from backend.modules.runtime.service import RuntimeService


def get_config(request: Request) -> Config:
    return request.app.state.config


async def get_db_session() -> AsyncSession:
    async for session in db_manager.get_async_session():
        yield session


def get_runtime_service(request: Request) -> RuntimeService:
    return request.app.state.runtime_service
