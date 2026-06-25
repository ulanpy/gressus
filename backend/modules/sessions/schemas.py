"""Session request/response DTOs."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from backend.modules.sessions.enums import SessionStatus


class SessionBase(BaseModel):
    session_date: date | None = None
    exo_profile: dict[str, Any] | None = None


class SessionCreate(SessionBase):
    """``session_number`` and ``status`` are assigned by the service."""


class SessionUpdate(BaseModel):
    session_date: date | None = None
    exo_profile: dict[str, Any] | None = None


class SessionStatusUpdate(BaseModel):
    """Body for the status-transition endpoint."""

    status: SessionStatus


class SessionRead(SessionBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    session_id: UUID = Field(validation_alias="id")
    patient_id: UUID
    session_number: int | None = None
    status: SessionStatus
    started_at: datetime | None = None
    ended_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
