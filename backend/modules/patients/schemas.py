from datetime import date, datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class Sex(str, Enum):
    MALE = "M"
    FEMALE = "F"
    OTHER = "other"
    UNKNOWN = "unknown"


class PatientBase(BaseModel):
    display_name: str
    date_of_birth: date | None = None
    sex: str
    cp_type: str | None = None
    affected_side: str | None = None
    gmfcs_current: str | None = None
    dominant_side: str | None = None
    comorbidities: str | None = None
    contraindications: str | None = None
    consent_on_file: bool = False
    consent_date: date | None = None
    guardian_contact: str | None = None
    enrollment_date: date | None = None


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    """Partial update; every field optional."""

    display_name: str | None = None
    date_of_birth: date | None = None
    sex: Sex | None = None
    cp_type: str | None = None
    affected_side: str | None = None
    gmfcs_current: str | None = None
    dominant_side: str | None = None
    comorbidities: str | None = None
    contraindications: str | None = None
    consent_on_file: bool | None = None
    consent_date: date | None = None
    guardian_contact: str | None = None
    enrollment_date: date | None = None


class PatientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    patient_id: UUID = Field(validation_alias="id")
    display_name: str
    date_of_birth: date | None = None
    sex: str
    cp_type: str | None = None
    affected_side: str | None = None
    gmfcs_current: str | None = None
    dominant_side: str | None = None
    comorbidities: str | None = None
    contraindications: str | None = None
    consent_on_file: bool = False
    consent_date: date | None = None
    guardian_contact: str | None = None
    enrollment_date: date | None = None
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None = None
