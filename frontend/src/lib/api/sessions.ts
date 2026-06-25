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

export type LatestExoProfile = {
  sessionNumber: number | null
  sessionDate: string | null
  profileJson: string
}

/** Most recent session's recorded exo profile for a patient (or null if none). */
export async function getLatestExoProfile(patientId: string): Promise<LatestExoProfile | null> {
  const sessions = await listPatientSessions(patientId)
  const withProfile = sessions.filter(
    (s) => s.exo_profile && Object.keys(s.exo_profile).length > 0,
  )
  if (!withProfile.length) return null
  const latest = withProfile.reduce((a, b) =>
    (b.session_number ?? 0) > (a.session_number ?? 0) ? b : a,
  )
  return {
    sessionNumber: latest.session_number,
    sessionDate: latest.session_date,
    profileJson: JSON.stringify(latest.exo_profile, null, 2),
  }
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
