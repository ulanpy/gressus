"""Session request/response DTOs."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from backend.modules.sessions.enums import SessionStatus


class SessionBase(BaseModel):
    session_date: date | None = None
    session_type: str | None = None
    passive_calibration_done: bool = False
    baseline_force_right: Decimal | None = None
    baseline_force_left: Decimal | None = None
    sampling_rate_hz: Decimal | None = None


class SessionCreate(SessionBase):
    """``session_number`` and ``status`` are assigned by the service."""


class SessionUpdate(BaseModel):
    session_date: date | None = None
    session_type: str | None = None
    passive_calibration_done: bool | None = None
    baseline_force_right: Decimal | None = None
    baseline_force_left: Decimal | None = None
    sampling_rate_hz: Decimal | None = None


class SessionStatusUpdate(BaseModel):
    """Body for the status-transition endpoint."""

    status: SessionStatus


class SessionRead(SessionBase):
    model_config = ConfigDict(from_attributes=True)

    session_id: UUID
    patient_id: UUID
    session_number: int | None = None
    status: SessionStatus
    created_at: datetime
    updated_at: datetime
