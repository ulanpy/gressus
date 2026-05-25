"""Insole TCP receiver lifecycle."""

from __future__ import annotations

from fastapi import FastAPI

from backend.core.configs.config import Config
from backend.modules.insole.receiver import InsoleTcpReceiver


def setup_insole_receiver(app: FastAPI, cfg: Config) -> InsoleTcpReceiver:
    receiver = InsoleTcpReceiver(cfg.INSOLE_HOST, cfg.INSOLE_PORT)
    receiver.start()
    app.state.insole_receiver = receiver
    return receiver


def cleanup_insole_receiver(app: FastAPI) -> None:
    receiver: InsoleTcpReceiver | None = getattr(app.state, "insole_receiver", None)
    if receiver is not None:
        receiver.stop()
        app.state.insole_receiver = None
