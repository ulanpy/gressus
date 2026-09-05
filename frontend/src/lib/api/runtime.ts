import { apiGet, apiPost } from './client'

export type SessionActionResponse = {
  ok: boolean
  success: boolean
  message: string
  sessionId?: string | null
}

export type SessionStartBody = {
  patientId: string
  profileJson?: string
  anthropometrics?: {
    leg_length_left?: number | null
    leg_length_right?: number | null
    bodyweight?: number | null
  } | null
}

export type ActiveJobSnapshot = {
  name: string
  command: string[]
  pid: number
  uptimeS: number
  dir?: string | null
  ownerSessionId?: string | null
}

export type PgearStatusSnapshot = {
  nodeAvailable: boolean
  connected: boolean
  error?: string | null
}

export type RuntimeSnapshot = {
  state: 'idle' | 'running'
  activeJob: ActiveJobSnapshot | null
  activity: {
    state: 'idle' | 'running'
    activeJob: ActiveJobSnapshot | null
  }
  pgear: PgearStatusSnapshot
}

export type RuntimeActivityKind = 'calibration' | 'game'

export type RuntimeActivityStartBody = {
  kind: RuntimeActivityKind
  params: Record<string, string | number>
  ownerSessionId?: string | null
}

export type RuntimeActivityResponse = {
  ok: boolean
  stopped?: boolean | null
  pid?: number | null
  kind?: string | null
  error?: string | null
}

export function getRuntimeStatus(): Promise<RuntimeSnapshot> {
  return apiGet<RuntimeSnapshot>('/runtime/status')
}

export function startRecordingSession(body: SessionStartBody): Promise<SessionActionResponse> {
  return apiPost<SessionActionResponse>('/runtime/session/start', body)
}

export function stopRecordingSession(): Promise<SessionActionResponse> {
  return apiPost<SessionActionResponse>('/runtime/session/stop')
}

export function startRuntimeActivity(body: RuntimeActivityStartBody): Promise<RuntimeActivityResponse> {
  return apiPost<RuntimeActivityResponse>('/runtime/activity/start', body)
}

export function stopRuntimeActivity(): Promise<RuntimeActivityResponse> {
  return apiPost<RuntimeActivityResponse>('/runtime/activity/stop')
}
