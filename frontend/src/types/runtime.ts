export type RuntimeJobName = 'game' | 'calibrate_apriltag'

export type RuntimeActiveJob = {
  name: RuntimeJobName
  command: string[]
  pid: number
  uptimeS: number
} | null

export type RuntimePayload = {
  state: 'idle' | 'running'
  activeJob: RuntimeActiveJob
  lastExit: {
    name: RuntimeJobName | null
    code: number | null
    finishedAt: number
  } | null
}

export type GameLaunchParams = {
  display: number | null
  outputRotation: 0 | 90 | 180 | 270
  insoleThresholdKpa: number
  speed: number
  stepTimeS: number
}
