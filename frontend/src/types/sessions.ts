export type SessionStatus = 'active' | 'completed' | 'failed' | 'aborted'

/** Normalized session (API `session_id` mapped to `id`). Mirrors backend `SessionRead`. */
export type TherapySession = {
  id: string
  patient_id: string
  session_number: number | null
  session_date: string | null
  status: SessionStatus
  exo_profile: Record<string, unknown> | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
}

export type SessionCreateBody = {
  session_date?: string | null
  exo_profile?: Record<string, unknown> | null
}

export type SessionUpdate = {
  session_date?: string | null
  exo_profile?: Record<string, unknown> | null
}

/** Raw API response shape. */
export type SessionDto = Omit<TherapySession, 'id'> & { session_id: string }
