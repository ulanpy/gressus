export type ExoskeletonJointTelemetry = {
  name: string
  refPos: number
  pos: number
  vel: number
  measTorque: number
  iq: number
}

export type ExoskeletonTelemetryFrame = {
  source: 'live'
  seq: number
  connected: boolean
  error: string | null
  gaitPhase: number
  gaitPhaseName: string
  stepIdx: number
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
  joints: ExoskeletonJointTelemetry[]
}
