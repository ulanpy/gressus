"""Session manager lifecycle hooks."""

from __future__ import annotations

import httpx
from fastapi import FastAPI

from backend.core.configs.config import Config
from backend.modules.runtime.client import SessionManagerClient, SessionManagerError
from backend.modules.runtime.schemas import SessionStopPayload


def setup_runtime_manager(app: FastAPI, cfg: Config) -> None:
    # The httpx connection pool is the only thing that must be a singleton;
    # RuntimeService itself is built per request (it needs a DB session).
    http_client = httpx.AsyncClient(timeout=cfg.SESSION_MANAGER_TIMEOUT_S)
    session_manager = SessionManagerClient(config=cfg, client=http_client)
    app.state.session_manager = session_manager
    app.state.runtime_ready = True


async def cleanup_runtime_manager(app: FastAPI) -> None:
    session_manager: SessionManagerClient | None = getattr(app.state, "session_manager", None)
    if session_manager is not None:
        try:
            await session_manager.stop_exo(SessionStopPayload(timeoutS=2.0))
        except SessionManagerError:
            pass
        await session_manager.aclose()
    app.state.session_manager = None
    app.state.runtime_ready = None
