"""Assessment ORM model.

The header lives in ``assessments``; the entire Pre-Assessment Form payload
(body, spatial gait, walking tests, observations, raw trials + computed
averages) is one JSONB document in ``form_data``.
"""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.database.base import Base, TimestampMixin
from backend.modules.patients.models import Patient  # noqa: F401 — registers mapper for relationship()


class Assessment(Base, TimestampMixin):
    __tablename__ = "assessments"

    id: Mapped[uuid.UUID] = mapped_column(
        "assessment_id",
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
    assessment_date: Mapped[date | None] = mapped_column(Date)
    assessment_type: Mapped[str | None] = mapped_column(Text)
    assessment_number: Mapped[int | None] = mapped_column(Integer)
    assessor: Mapped[str | None] = mapped_column(Text)

    form_data: Mapped[dict | None] = mapped_column(JSONB)

    patient: Mapped["Patient"] = relationship(back_populates="assessments")