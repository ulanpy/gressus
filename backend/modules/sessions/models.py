"""Session ORM model."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, Enum as SAEnum, ForeignKey, Integer, Numeric, Text
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.database.base import Base, TimestampMixin
from backend.modules.sessions.enums import SessionStatus

if TYPE_CHECKING:
    from backend.modules.patients.models import Patient


class Session(Base, TimestampMixin):
    __tablename__ = "sessions"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.patient_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_date: Mapped[date | None] = mapped_column(Date)
    session_type: Mapped[str | None] = mapped_column(Text)
    session_number: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[SessionStatus] = mapped_column(
        SAEnum(
            SessionStatus,
            name="session_status",
            # store the lowercase ``.value`` ("active") rather than the name ("ACTIVE")
            values_callable=lambda enum: [member.value for member in enum],
        ),
        nullable=False,
        default=SessionStatus.ACTIVE,
        server_default=SessionStatus.ACTIVE.value,
    )
    passive_calibration_done: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    baseline_force_right: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    baseline_force_left: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    sampling_rate_hz: Mapped[Decimal | None] = mapped_column(Numeric)

    patient: Mapped["Patient"] = relationship(back_populates="sessions")
