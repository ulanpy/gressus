import { apiGet, apiPatch, apiPost } from './client'
import type { SessionCreateBody, SessionUpdate, TherapySession } from '../../types/sessions'

export function listPatientSessions(patientId: string): Promise<TherapySession[]> {
  return apiGet<TherapySession[]>(`/patients/${patientId}/sessions`)
}

export function createSession(patientId: string, data: SessionCreateBody): Promise<TherapySession> {
  return apiPost<TherapySession>(`/patients/${patientId}/sessions`, data)
}

export function getSession(sessionId: string): Promise<TherapySession> {
  return apiGet<TherapySession>(`/sessions/${sessionId}`)
}

export function updateSession(sessionId: string, data: SessionUpdate): Promise<TherapySession> {
  return apiPatch<TherapySession>(`/sessions/${sessionId}`, data)
}
