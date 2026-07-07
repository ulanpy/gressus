"""FastAPI dependencies for the runtime module."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from backend.modules.runtime.service import RuntimeService
from backend.modules.sessions.dependencies import get_session_service
from backend.modules.sessions.service import SessionService


def get_runtime_service(
    request: Request,
    sessions: Annotated[SessionService, Depends(get_session_service)],
) -> RuntimeService:
    return RuntimeService(
        session_manager=request.app.state.session_manager,
        sessions=sessions,
    )
