"""Session manager lifecycle hooks."""

from __future__ import annotations

import httpx
from fastapi import FastAPI

from backend.core.configs.config import Config


def setup_runtime_manager(app: FastAPI, cfg: Config) -> None:
    app.state.runtime_ready = True


def cleanup_runtime_manager(app: FastAPI) -> None:
    cfg: Config = app.state.config
    try:
        with httpx.Client(timeout=cfg.SESSION_MANAGER_TIMEOUT_S) as client:
            client.post(
                f"{cfg.SESSION_MANAGER_URL.rstrip('/')}/session/stop",
                json={"timeoutS": 2.0},
            )
    except httpx.HTTPError:
        pass
    app.state.runtime_ready = None
