import { apiGet, apiPost } from './client'
import type { GameLaunchParams } from '../../types/runtime'

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
}

export type PgearStatusSnapshot = {
  nodeAvailable: boolean
  connected: boolean
  error?: string | null
}

export type RuntimeSnapshot = {
  state: 'idle' | 'running'
  activeJob: ActiveJobSnapshot | null
  pgear: PgearStatusSnapshot
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

export function startGame(params: GameLaunchParams): Promise<unknown> {
  return apiPost('/runtime/stack/start', { job: 'game', ...params })
}

export function startCameraCalibration(outputRotation = 270): Promise<unknown> {
  return apiPost('/runtime/stack/start', { job: 'calibrate_apriltag', outputRotation })
}

export function stopRuntimeStack(): Promise<unknown> {
  return apiPost('/runtime/stack/stop', { timeoutS: 3 })
}
