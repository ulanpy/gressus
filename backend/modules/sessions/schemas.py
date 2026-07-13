"""Session request/response DTOs."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from backend.modules.sessions.enums import AnalyticsStatus, SessionStatus


class SessionAnthropometrics(BaseModel):
    """Leg lengths (m) and body weight (kg) stored as one JSON object on the session."""

    model_config = ConfigDict(extra="forbid")

    leg_length_left: float | None = Field(default=None, gt=0)
    leg_length_right: float | None = Field(default=None, gt=0)
    bodyweight: float | None = Field(default=None, gt=0)


class SessionBase(BaseModel):
    session_date: date | None = None
    exo_profile: dict[str, Any] | None = None
    anthropometrics: SessionAnthropometrics | None = None


class SessionCreate(SessionBase):
    """``session_number`` and ``status`` are assigned by the service."""


class SessionUpdate(BaseModel):
    session_date: date | None = None
    exo_profile: dict[str, Any] | None = None
    anthropometrics: SessionAnthropometrics | None = None


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
    analytics_status: AnalyticsStatus | None = None
    analytics_metrics: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime
