"""Application settings (env-backed, pydantic-settings)."""

from __future__ import annotations

from functools import cached_property
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    INSOLE_THRESHOLD_KPA: float = 8.0
    INSOLE_WS_URL: str = "ws://127.0.0.1:8765/ws/insole"
    ROS_CONTAINER: str | None = None
    ROS_SETUP: str = "/opt/ros/jazzy/setup.bash"
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    QT_QPA_PLATFORM: str = "xcb"

    @cached_property
    def repo_root(self) -> Path:
        return REPO_ROOT


config = Config()
