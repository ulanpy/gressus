"""Shared FastAPI dependencies."""

from __future__ import annotations

from fastapi import Request

from backend.core.configs.config import Config
from backend.modules.insole.service import InsoleService
from backend.modules.runtime.service import RuntimeService
from backend.runtime.process_manager import ProcessManager


def get_config(request: Request) -> Config:
    return request.app.state.config


def get_process_manager(request: Request) -> ProcessManager:
    return request.app.state.process_manager


def get_insole_service(_request: Request) -> InsoleService:
    return InsoleService()


def get_runtime_service(request: Request) -> RuntimeService:
    return RuntimeService(
        process_manager=request.app.state.process_manager,
        config=request.app.state.config,
    )
