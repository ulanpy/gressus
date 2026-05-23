export type RuntimeJobName = 'game' | 'calibrate_apriltag'

export type RuntimeActiveJob = {
  name: RuntimeJobName
  command: string[]
  pid: number
  uptimeS: number
  logPath?: string | null
} | null

export type RuntimePayload = {
  state: 'idle' | 'running'
  activeJob: RuntimeActiveJob
  lastExit: {
    name: RuntimeJobName | null
    code: number | null
    finishedAt: number
    logPath?: string | null
  } | null
}

export type GameLaunchParams = {
  display: number | null
  outputRotation: 0 | 90 | 180 | 270
  insoleThresholdKpa: number
  noInsole: boolean
  demo: boolean
  speed: number
  stepTimeS: number
}
