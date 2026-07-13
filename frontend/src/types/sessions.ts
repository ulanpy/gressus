export type SessionStatus = 'active' | 'completed' | 'failed' | 'aborted'

/** Leg lengths (m) and body weight (kg) stored on the session. */
export type SessionAnthropometrics = {
  leg_length_left?: number | null
  leg_length_right?: number | null
  bodyweight?: number | null
}

/** Normalized session (API `session_id` mapped to `id`). Mirrors backend `SessionRead`. */
export type TherapySession = {
  id: string
  patient_id: string
  session_number: number | null
  session_date: string | null
  status: SessionStatus
  exo_profile: Record<string, unknown> | null
  anthropometrics: SessionAnthropometrics | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
}

export type SessionCreateBody = {
  session_date?: string | null
  exo_profile?: Record<string, unknown> | null
  anthropometrics?: SessionAnthropometrics | null
}

export type SessionUpdate = {
  session_date?: string | null
  exo_profile?: Record<string, unknown> | null
  anthropometrics?: SessionAnthropometrics | null
}

/** Raw API response shape. */
export type SessionDto = Omit<TherapySession, 'id'> & { session_id: string }
