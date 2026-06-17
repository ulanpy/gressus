from typing import Any, Dict
from uuid import UUID
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

class SessionStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    ABORTED = "aborted"


class SessionCreateBody(BaseModel):
    started_at: datetime
    launch_config: Dict[str, Any] = Field(default_factory=dict)
    notes: str | None = None


class SessionCreate(SessionCreateBody):
    patient_id: UUID


class SessionUpdate(BaseModel):
    ended_at: datetime | None = None
    status: SessionStatus | None = None
    notes: str | None = None
    launch_config: Dict[str, Any] | None = None


class SessionRead(BaseModel):
    id: UUID
    patient_id: UUID
    session_number: int
    started_at: datetime
    ended_at: datetime | None
    status: SessionStatus
    launch_config: Dict[str, Any]
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}