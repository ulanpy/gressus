"""Assessment ORM models: the assessment header and its four 1:1 detail tables.

Each detail table shares the assessment's primary key (column ``assessment_id`` is
both PK and FK), giving a strict one-to-one relationship with ``assessments``.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
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

    patient: Mapped["Patient"] = relationship(back_populates="assessments")

    body: Mapped["AssessmentBody | None"] = relationship(
        back_populates="assessment",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    spatial_gait: Mapped["AssessmentSpatialGait | None"] = relationship(
        back_populates="assessment",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    walking_tests: Mapped["AssessmentWalkingTests | None"] = relationship(
        back_populates="assessment",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    observations: Mapped["AssessmentObservations | None"] = relationship(
        back_populates="assessment",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )


class AssessmentBody(Base):
    __tablename__ = "assessment_body"

    id: Mapped[uuid.UUID] = mapped_column(
        "assessment_id",
        UUID(as_uuid=True),
        ForeignKey("assessments.assessment_id", ondelete="CASCADE"),
        primary_key=True,
    )
    body_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    height_cm: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    leg_length_left_m: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))
    leg_length_right_m: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))

    assessment: Mapped["Assessment"] = relationship(back_populates="body")


class AssessmentSpatialGait(Base):
    __tablename__ = "assessment_spatial_gait"

    id: Mapped[uuid.UUID] = mapped_column(
        "assessment_id",
        UUID(as_uuid=True),
        ForeignKey("assessments.assessment_id", ondelete="CASCADE"),
        primary_key=True,
    )
    step_length_left_cm: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    step_length_right_cm: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    stride_length_left_cm: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    stride_length_right_cm: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    step_width_cm: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    step_symmetry_index_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    foot_angle_left: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    foot_angle_right: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))

    assessment: Mapped["Assessment"] = relationship(back_populates="spatial_gait")


class AssessmentWalkingTests(Base):
    __tablename__ = "assessment_walking_tests"

    id: Mapped[uuid.UUID] = mapped_column(
        "assessment_id",
        UUID(as_uuid=True),
        ForeignKey("assessments.assessment_id", ondelete="CASCADE"),
        primary_key=True,
    )
    cadence_steps_min: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    speed_10mwt_comfort_ms: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    speed_10mwt_fast_ms: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    tug_seconds: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    distance_6mwt_m: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    assessment: Mapped["Assessment"] = relationship(back_populates="walking_tests")


class AssessmentObservations(Base):
    __tablename__ = "assessment_observations"

    id: Mapped[uuid.UUID] = mapped_column(
        "assessment_id",
        UUID(as_uuid=True),
        ForeignKey("assessments.assessment_id", ondelete="CASCADE"),
        primary_key=True,
    )
    toe_walking: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    foot_dragging: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    hip_hiking: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    circumduction: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    crouched_gait: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    scissor_gait: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reduced_arm_swing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    uses_aid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    needs_support: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text)

    assessment: Mapped["Assessment"] = relationship(back_populates="observations")