import { apiPost } from './client'

export type SessionActionResponse = {
  ok: boolean
  success: boolean
  message: string
  sessionId?: string | null
}

export type SessionStartBody = {
  patientId: string
  profileJson?: string
}

export function startRecordingSession(body: SessionStartBody): Promise<SessionActionResponse> {
  return apiPost<SessionActionResponse>('/runtime/session/start', body)
}

export function stopRecordingSession(): Promise<SessionActionResponse> {
  return apiPost<SessionActionResponse>('/runtime/session/stop')
}
