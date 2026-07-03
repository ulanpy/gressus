"""Assessment DTOs. The full form lives in ``form_data`` (JSONB)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AssessmentBase(BaseModel):
    assessment_date: date | None = None
    assessment_type: str | None = None
    assessor: str | None = None


class AssessmentCreate(AssessmentBase):
    """Header + full form document. ``assessment_number`` is assigned by the service."""

    form_data: dict[str, Any] | None = None


class AssessmentUpdate(BaseModel):
    assessment_date: date | None = None
    assessment_type: str | None = None
    assessor: str | None = None
    form_data: dict[str, Any] | None = None


class AssessmentRead(AssessmentBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    assessment_id: UUID = Field(validation_alias="id")
    patient_id: UUID
    assessment_number: int | None = None
    created_at: datetime
    updated_at: datetime
    form_data: dict[str, Any] | None = None