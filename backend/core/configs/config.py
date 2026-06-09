"""Application settings (env-backed, pydantic-settings)."""

from __future__ import annotations

from functools import cached_property
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Config(BaseSettings):
    POSTGRES_DB: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_HOST: str
    POSTGRES_PORT: int
    RUN_MIGRATIONS: bool = True
    model_config = SettingsConfigDict(
        env_file= REPO_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    INSOLE_THRESHOLD_KPA: float = 8.0
    INSOLE_WS_URL: str = "ws://127.0.0.1:8765/ws/insole"
    SESSION_MANAGER_URL: str = "http://127.0.0.1:9090"
    SESSION_MANAGER_TIMEOUT_S: float = 10.0
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    QT_QPA_PLATFORM: str = "xcb"

    @cached_property
    def repo_root(self) -> Path:
        return REPO_ROOT
    
    @cached_property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @cached_property
    def SYNC_DATABASE_URL(self) -> str:
        """Sync driver URL for Alembic migrations."""
        return self.DATABASE_URL.replace("postgresql+asyncpg", "postgresql+psycopg2")


config = Config()
