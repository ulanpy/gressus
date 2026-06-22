export type BodyData = {
  body_weight_kg?: number | null
  height_cm?: number | null
  leg_length_left_m?: number | null
  leg_length_right_m?: number | null
}

export type SpatialGaitData = {
  step_length_left_cm?: number | null
  step_length_right_cm?: number | null
  stride_length_left_cm?: number | null
  stride_length_right_cm?: number | null
  step_width_cm?: number | null
  step_symmetry_index_pct?: number | null
  foot_angle_left?: number | null
  foot_angle_right?: number | null
}

export type WalkingTestsData = {
  cadence_steps_min?: number | null
  speed_10mwt_comfort_ms?: number | null
  speed_10mwt_fast_ms?: number | null
  tug_seconds?: number | null
  distance_6mwt_m?: number | null
}

export type ObservationsData = {
  toe_walking?: boolean
  foot_dragging?: boolean
  hip_hiking?: boolean
  circumduction?: boolean
  crouched_gait?: boolean
  scissor_gait?: boolean
  reduced_arm_swing?: boolean
  uses_aid?: boolean
  needs_support?: boolean
  notes?: string | null
}

/** Normalized assessment (API `assessment_id` mapped to `id`). */
export type Assessment = {
  id: string
  patient_id: string
  assessment_date: string | null
  assessment_type: string | null
  assessment_number: number | null
  created_at: string
  updated_at: string
  body: BodyData | null
  spatial_gait: SpatialGaitData | null
  walking_tests: WalkingTestsData | null
  observations: ObservationsData | null
}

export type AssessmentCreate = {
  assessment_date?: string | null
  assessment_type?: string | null
  body?: BodyData | null
  spatial_gait?: SpatialGaitData | null
  walking_tests?: WalkingTestsData | null
  observations?: ObservationsData | null
}

export type AssessmentUpdate = {
  assessment_date?: string | null
  assessment_type?: string | null
}

/** Raw API response shape. */
export type AssessmentDto = Omit<Assessment, 'id'> & { assessment_id: string }
