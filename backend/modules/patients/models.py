"""SQLAlchemy ORM model for Patient."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict

from sqlalchemy import CheckConstraint, DateTime, Index, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from backend.core.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(nullable=True)
    sex: Mapped[str | None] = mapped_column(
        Text,
        CheckConstraint("sex IN ('M', 'F', 'other', 'unknown')", name="patients_sex_check"),
        nullable=False,
    )
    diagnosis_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    profile: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index(
            "idx_patients_active",
            "created_at",
            postgresql_where="archived_at IS NULL",
        ),
    )