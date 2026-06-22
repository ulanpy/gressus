export type SessionStatus = 'active' | 'completed' | 'failed' | 'aborted'

/** Normalized session (API `session_id` mapped to `id`). */
export type TherapySession = {
  id: string
  patient_id: string
  session_number: number | null
  session_date: string | null
  session_type: string | null
  status: SessionStatus
  passive_calibration_done: boolean
  baseline_force_right: number | null
  baseline_force_left: number | null
  sampling_rate_hz: number | null
  created_at: string
  updated_at: string
}

export type SessionCreateBody = {
  session_date?: string | null
  session_type?: string | null
  passive_calibration_done?: boolean
  baseline_force_right?: number | null
  baseline_force_left?: number | null
  sampling_rate_hz?: number | null
}

export type SessionUpdate = {
  session_date?: string | null
  session_type?: string | null
  passive_calibration_done?: boolean
  baseline_force_right?: number | null
  baseline_force_left?: number | null
  sampling_rate_hz?: number | null
}

/** Raw API response shape. */
export type SessionDto = Omit<TherapySession, 'id'> & { session_id: string }
