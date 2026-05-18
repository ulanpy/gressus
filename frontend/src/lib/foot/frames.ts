import type { FootStats, FootFrame, SensorPoint } from '../../types/insole'

export function emptyStats(): FootStats {
  return { maxKpa: 0, meanKpa: 0, sumKpa: 0, pressed: false, hasData: false }
}
export function buildFootFrame(
  sensors: SensorPoint[],
  values: number[] | null | undefined,
  stats: FootStats | undefined,
  online: boolean,
): FootFrame {
  return {
    points: sensors.map((point) => ({ ...point, pressure: values?.[point.index] ?? 0 })),
    stats: stats ?? emptyStats(),
    online,
  }
}
