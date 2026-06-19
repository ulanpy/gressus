export type SessionStatus = 'active' | 'completed' | 'failed' | 'aborted'

export type TherapySession = {
  id: string
  patient_id: string
  session_number: number
  started_at: string
  ended_at: string | null
  status: SessionStatus
  notes: string | null
  created_at: string
}

export type SessionCreateBody = {
  started_at: string
  notes?: string | null
}

export type SessionUpdate = {
  ended_at?: string | null
  status?: SessionStatus
  notes?: string | null
}
