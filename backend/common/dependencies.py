"""Shared FastAPI dependencies."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import db_manager


async def get_db_session() -> AsyncSession:
    async for session in db_manager.get_async_session():
        yield session
