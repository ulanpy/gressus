"""Patient ORM model."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.database.base import Base, TimestampMixin

if TYPE_CHECKING:
    from backend.modules.assessments.models import Assessment
    from backend.modules.sessions.models import Session


class Patient(Base, TimestampMixin):
    __tablename__ = "patients"
    __table_args__ = (
        CheckConstraint(
            "sex IN ('M', 'F', 'other', 'unknown')",
            name="patients_sex_check",
        ), 
    )

    id: Mapped[uuid.UUID] = mapped_column(
        "patient_id",
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    sex: Mapped[str] = mapped_column(Text, nullable=False)
    cp_type: Mapped[str | None] = mapped_column(Text)
    affected_side: Mapped[str | None] = mapped_column(Text)
    gmfcs_current: Mapped[str | None] = mapped_column(Text)
    dominant_side: Mapped[str | None] = mapped_column(Text)
    comorbidities: Mapped[str | None] = mapped_column(Text)
    contraindications: Mapped[str | None] = mapped_column(Text)
    consent_on_file: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    consent_date: Mapped[date | None] = mapped_column(Date)
    guardian_contact: Mapped[str | None] = mapped_column(Text)
    enrollment_date: Mapped[date | None] = mapped_column(Date)

    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    sessions: Mapped[list["Session"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    assessments: Mapped[list["Assessment"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )