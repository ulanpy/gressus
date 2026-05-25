"""Shared FastAPI dependencies."""

from __future__ import annotations

from fastapi import Request

from backend.core.configs.config import Config
from backend.modules.insole.receiver import InsoleTcpReceiver
from backend.modules.insole.service import InsoleService
from backend.modules.runtime.service import RuntimeService
from backend.runtime.process_manager import ProcessManager


def get_config(request: Request) -> Config:
    return request.app.state.config


def get_insole_receiver(request: Request) -> InsoleTcpReceiver | None:
    return getattr(request.app.state, "insole_receiver", None)


def get_process_manager(request: Request) -> ProcessManager:
    return request.app.state.process_manager


def get_insole_service(request: Request) -> InsoleService:
    return InsoleService(
        receiver=get_insole_receiver(request),
        process_manager=request.app.state.process_manager,
        config=request.app.state.config,
    )


def get_runtime_service(request: Request) -> RuntimeService:
    return RuntimeService(
        process_manager=request.app.state.process_manager,
        config=request.app.state.config,
    )
