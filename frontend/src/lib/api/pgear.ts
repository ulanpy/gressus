import { apiPost } from './client'

export type PgearCommandResponse = {
  ok: boolean
  success: boolean
  message: string
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
}

export function postPgearCommand(
  command: PgearCommandKey,
  body?: unknown,
): Promise<PgearCommandResponse> {
  return apiPost<PgearCommandResponse>(pgearPaths[command], body)
}
