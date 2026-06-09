from typing import Any, Dict
from uuid import UUID
from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field


class Sex(str, Enum):
    MALE = "M"
    FEMALE = "F"
    OTHER = "other"
    UNKNOWN = "unknown"

class PatientCreate(BaseModel):
    display_name: str
    date_of_birth: date | None = None
    sex: Sex
    diagnosis_note: str | None = None
    profile: Dict[str, Any] = Field(default_factory=dict)


class PatientUpdate(BaseModel):
    display_name: str | None = None
    date_of_birth: date | None = None
    sex: Sex | None = None
    diagnosis_note: str | None = None
    profile: Dict[str, Any] | None = None


class PatientRead(BaseModel):
    id: UUID
    display_name: str
    date_of_birth: date | None
    sex: Sex
    diagnosis_note: str | None
    profile: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None

    model_config = {"from_attributes": True}