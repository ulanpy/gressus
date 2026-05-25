"""Local subprocess runtime lifecycle."""

from __future__ import annotations

import time

from fastapi import FastAPI

from backend.core.configs.config import Config
from backend.runtime.process_manager import ProcessManager


def setup_runtime_manager(app: FastAPI, cfg: Config) -> ProcessManager:
    manager = ProcessManager(cwd=cfg.repo_root)
    app.state.process_manager = manager
    app.state.started_at = time.monotonic()
    return manager


def cleanup_runtime_manager(app: FastAPI) -> None:
    manager: ProcessManager | None = getattr(app.state, "process_manager", None)
    if manager is not None:
        manager.shutdown()
        app.state.process_manager = None
