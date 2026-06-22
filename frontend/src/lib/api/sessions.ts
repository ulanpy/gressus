import { apiGet, apiPatch, apiPost } from './client'
import type {
  SessionCreateBody,
  SessionDto,
  SessionStatus,
  SessionUpdate,
  TherapySession,
} from '../../types/sessions'

function fromSessionDto(dto: SessionDto): TherapySession {
  const { session_id, ...rest } = dto
  return { id: session_id, ...rest }
}

export function listPatientSessions(patientId: string): Promise<TherapySession[]> {
  return apiGet<SessionDto[]>(`/patients/${patientId}/sessions`).then((rows) =>
    rows.map(fromSessionDto),
  )
}

export function createSession(
  patientId: string,
  data: SessionCreateBody,
): Promise<TherapySession> {
  return apiPost<SessionDto>(`/patients/${patientId}/sessions`, data).then(fromSessionDto)
}

export function getSession(patientId: string, sessionId: string): Promise<TherapySession> {
  return apiGet<SessionDto>(`/patients/${patientId}/sessions/${sessionId}`).then(fromSessionDto)
}

export function updateSession(
  patientId: string,
  sessionId: string,
  data: SessionUpdate,
): Promise<TherapySession> {
  return apiPatch<SessionDto>(`/patients/${patientId}/sessions/${sessionId}`, data).then(
    fromSessionDto,
  )
}

export function updateSessionStatus(
  patientId: string,
  sessionId: string,
  status: SessionStatus,
): Promise<TherapySession> {
  return apiPatch<SessionDto>(`/patients/${patientId}/sessions/${sessionId}/status`, {
    status,
  }).then(fromSessionDto)
}
