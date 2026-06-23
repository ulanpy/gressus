import type { GeometryPayload, InsoleSize } from '../../types/insole'
import * as sensorsM from './sensorsM'
import * as sensorsS from './sensorsS'

const GEOMETRY: Record<InsoleSize, Omit<GeometryPayload, 'size'>> = {
  m: {
    sensorSideMm: sensorsM.SENSOR_SIDE_MM,
    left: sensorsM.LEFT_MM,
    right: sensorsM.RIGHT_MM,
  },
  s: {
    sensorSideMm: sensorsS.SENSOR_SIDE_MM,
    left: sensorsS.LEFT_MM,
    right: sensorsS.RIGHT_MM,
  },
}

export function getInsoleGeometry(size: InsoleSize): GeometryPayload {
  const entry = GEOMETRY[size]
  return { size, ...entry }
}
