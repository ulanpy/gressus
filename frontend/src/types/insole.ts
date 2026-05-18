export type SourceMode = 'live' | 'mock'
export type InsoleSize = 'm' | 's'
export type FootSide = 'left' | 'right'

export type SensorPoint = {
  index: number
  x: number
  y: number
  xMm: number
  yMm: number
}

export type PressurePoint = SensorPoint & {
  pressure: number
}

export type FootStats = {
  maxKpa: number
  meanKpa: number
  sumKpa: number
  pressed: boolean
  hasData: boolean
}

export type FramePayload = {
  source: SourceMode
  available: boolean
  gameRunning: boolean
  seq: number | string | null
  dtMs: number | null
  connected: boolean
  ageS: number | null
  error: string | null
  leftOnline: boolean
  rightOnline: boolean
  left: number[] | null
  right: number[] | null
  leftStats: FootStats
  rightStats: FootStats
}

export type GeometryPayload = {
  size: InsoleSize
  sensorSideMm: number
  left: [number, number][]
  right: [number, number][]
}

export type FootFrame = {
  points: PressurePoint[]
  stats: FootStats
  online: boolean
}

export type FootSilhouette = {
  path: string
  edgeIndexes: number[]
}

export type PathPoint = {
  x: number
  y: number
}

export type FootDashboard = {
  dynamicScale: number
  leftFrame: FootFrame
  leftShare: number
  leftSilhouette: FootSilhouette
  rightFrame: FootFrame
  rightSilhouette: FootSilhouette
}
