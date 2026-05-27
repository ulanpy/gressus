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
    CALIBRATION_PATH: str = "config/calibration.json"
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    QT_QPA_PLATFORM: str = "xcb"

    @cached_property
    def repo_root(self) -> Path:
        return REPO_ROOT

    @cached_property
    def calibration_path(self) -> Path:
        return self.repo_root / self.CALIBRATION_PATH


config = Config()
