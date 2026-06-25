"""Session ORM model."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.database.base import Base, TimestampMixin
from backend.modules.sessions.enums import SessionStatus

if TYPE_CHECKING:
    from backend.modules.patients.models import Patient


class Session(Base, TimestampMixin):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        "session_id",
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.patient_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_date: Mapped[date | None] = mapped_column(Date)
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

    # Exoskeleton profile applied for this session: gait params + kind-0 coeffs
    # (keyed by cps) + meta. Shape mirrors the P.GEAR ``load_profile`` JSON.
    exo_profile: Mapped[dict | None] = mapped_column(JSONB)

    # Gait timing for the run tied to this session (rosbag window later).
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    patient: Mapped["Patient"] = relationship(back_populates="sessions")
