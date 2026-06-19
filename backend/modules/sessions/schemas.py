from uuid import UUID
from datetime import datetime
from enum import Enum

from pydantic import BaseModel

class SessionStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    ABORTED = "aborted"


class SessionCreateBody(BaseModel):
    started_at: datetime
    notes: str | None = None


class SessionCreate(SessionCreateBody):
    patient_id: UUID


class SessionUpdate(BaseModel):
    ended_at: datetime | None = None
    status: SessionStatus | None = None
    notes: str | None = None


class SessionRead(BaseModel):
    id: UUID
    patient_id: UUID
    session_number: int
    started_at: datetime
    ended_at: datetime | None
    status: SessionStatus
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}