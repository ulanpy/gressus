import type { SensorPoint } from '../../types/insole'


export function buildSensorGeometry(coords: [number, number][], sensorSideMm: number): SensorPoint[] {
  const xs = coords.map(([x]) => x)
  const ys = coords.map(([, y]) => y)
  const xmin = Math.min(...xs) - sensorSideMm * 2.2
  const xmax = Math.max(...xs) + sensorSideMm * 2.2
  const ymin = Math.min(...ys) - sensorSideMm * 2.2
  const ymax = Math.max(...ys) + sensorSideMm * 2.2
  const widthMm = xmax - xmin
  const heightMm = ymax - ymin
  const scale = Math.min(72 / widthMm, 96 / heightMm)
  const offsetX = 50 - (widthMm * scale) / 2
  const offsetY = 2 + (96 - heightMm * scale) / 2

  return coords.map(([xMm, yMm], index) => ({
    index,
    x: offsetX + (xMm - xmin) * scale,
    y: offsetY + (yMm - ymin) * scale,
    xMm,
    yMm,
  }))
}
