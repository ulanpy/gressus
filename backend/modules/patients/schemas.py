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
    model_config = ConfigDict(from_attributes=True)

    patient_id: UUID
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

