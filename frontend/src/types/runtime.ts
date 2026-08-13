export type GameLaunchParams = {
  display: number | null
  outputRotation: 0 | 90 | 180 | 270
  insoleThresholdKpa: number
  noInsole: boolean
  demo: boolean
  speed: number
  stepTimeS: number
}
