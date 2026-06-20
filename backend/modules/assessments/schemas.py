"""Assessment request/response DTOs, including the four 1:1 detail blocks."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


# --- detail blocks -------------------------------------------------------------


class BodyData(BaseModel):
    body_weight_kg: Decimal | None = None
    height_cm: Decimal | None = None
    leg_length_left_m: Decimal | None = None
    leg_length_right_m: Decimal | None = None


class SpatialGaitData(BaseModel):
    step_length_left_cm: Decimal | None = None
    step_length_right_cm: Decimal | None = None
    stride_length_left_cm: Decimal | None = None
    stride_length_right_cm: Decimal | None = None
    step_width_cm: Decimal | None = None
    step_symmetry_index_pct: Decimal | None = None
    foot_angle_left: Decimal | None = None
    foot_angle_right: Decimal | None = None


class WalkingTestsData(BaseModel):
    cadence_steps_min: Decimal | None = None
    speed_10mwt_comfort_ms: Decimal | None = None
    speed_10mwt_fast_ms: Decimal | None = None
    tug_seconds: Decimal | None = None
    distance_6mwt_m: Decimal | None = None


class ObservationsData(BaseModel):
    toe_walking: bool = False
    foot_dragging: bool = False
    hip_hiking: bool = False
    circumduction: bool = False
    crouched_gait: bool = False
    scissor_gait: bool = False
    reduced_arm_swing: bool = False
    uses_aid: bool = False
    needs_support: bool = False
    notes: str | None = None


class _BodyRead(BodyData):
    model_config = ConfigDict(from_attributes=True)


class _SpatialGaitRead(SpatialGaitData):
    model_config = ConfigDict(from_attributes=True)


class _WalkingTestsRead(WalkingTestsData):
    model_config = ConfigDict(from_attributes=True)


class _ObservationsRead(ObservationsData):
    model_config = ConfigDict(from_attributes=True)


# --- assessment header ---------------------------------------------------------


class AssessmentBase(BaseModel):
    assessment_date: date | None = None
    assessment_type: str | None = None


class AssessmentCreate(AssessmentBase):
    """Create an assessment header, optionally with any of its detail blocks.

    ``assessment_number`` is assigned automatically by the service.
    """

    body: BodyData | None = None
    spatial_gait: SpatialGaitData | None = None
    walking_tests: WalkingTestsData | None = None
    observations: ObservationsData | None = None


class AssessmentUpdate(BaseModel):
    assessment_date: date | None = None
    assessment_type: str | None = None


class AssessmentRead(AssessmentBase):
    model_config = ConfigDict(from_attributes=True)

    assessment_id: int
    patient_id: int
    assessment_number: int | None = None
    created_at: datetime
    updated_at: datetime
    body: _BodyRead | None = None
    spatial_gait: _SpatialGaitRead | None = None
    walking_tests: _WalkingTestsRead | None = None
    observations: _ObservationsRead | None = None
