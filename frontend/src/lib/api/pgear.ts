import { apiGet, apiPost } from './client'

export type PgearCommandResponse = {
  ok: boolean
  success: boolean
  message: string
  sessionId?: string | null
  coeffs?: string | null
}

export type PgearCommandKey =
  | 'loadProfile'
  | 'arm'
  | 'disarm'
  | 'run'
  | 'stopGait'
  | 'estop'
  | 'estopReset'
  | 'fullCal'
  | 'calibrateBaseline'
  | 'cancelCalibrate'

const pgearPaths: Record<PgearCommandKey, string> = {
  loadProfile: '/runtime/pgear/load-profile',
  arm: '/runtime/pgear/arm',
  disarm: '/runtime/pgear/disarm',
  run: '/runtime/pgear/run',
  stopGait: '/runtime/pgear/stop-gait',
  estop: '/runtime/pgear/estop',
  estopReset: '/runtime/pgear/estop-reset',
  fullCal: '/runtime/pgear/full-cal',
  calibrateBaseline: '/runtime/pgear/calibrate-baseline',
  cancelCalibrate: '/runtime/pgear/cancel-calibrate',
}

/** Body for the `run` command: opens a DB session for the patient. */
export type PgearRunBody = {
  patientId: string
  profileJson?: string
}

export function postPgearCommand(
  command: PgearCommandKey,
  body?: unknown,
): Promise<PgearCommandResponse> {
  return apiPost<PgearCommandResponse>(pgearPaths[command], body)
}

export type CalibrationState = 'idle' | 'running' | 'done' | 'failed' | 'cancelled'

export type CalibrationStatus = {
  ok: boolean
  state: CalibrationState
  message: string
  elapsedS: number
  remainingS: number
  progress: number
  runId?: number | null
  coeffs?: string | null
  sessionId?: string | null
}

/** Poll async baseline calibration (~1 s interval) after `calibrateBaseline`. */
export function getCalibrationStatus(): Promise<CalibrationStatus> {
  return apiGet<CalibrationStatus>('/runtime/pgear/calibration-status')
}
