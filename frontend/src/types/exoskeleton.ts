export type ExoskeletonJointTelemetry = {
  name: string
  refPos: number
  pos: number
  vel: number
  measTorque: number
  iq: number
  motorEffort?: number
}

export type ExoskeletonTelemetryFrame = {
  source: 'live' | 'mock'
  mode?: 'real' | 'mock'
  scenario?: string
  state?: string
  seq: number
  connected: boolean
  error: string | null
  gaitPhase: number
  gaitPhaseName: string
  stepIdx: number
  profileSlot?: number
  version?: number
  sensorHealthMask: number
  flags: number
  running: boolean
  estop: boolean
  sensorOnline: boolean
  aanOn: boolean
  linkAgeMs: number
  controllerTimeMs: number
  ampR: number
  ampL: number
  assistR: number
  assistL: number
  ctrlLoopUs?: number
  linkCrcFails?: number
  linkResyncs?: number
  crossCheckFault?: number
  hbErrorByte?: number
  hbAgeMs?: number[]
  joints: ExoskeletonJointTelemetry[]
}
