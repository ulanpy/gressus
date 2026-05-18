import { MAX_KPA } from '../../constants/insole'
import { PRESSURE_STOPS } from '../../constants/pressure'
import { clamp } from '../math'


export function pressureColor(value: number, scale = MAX_KPA) {
  const t = contrastIntensity(value / scale)
  const nextIndex = PRESSURE_STOPS.findIndex((stop) => t <= stop.t)

  if (nextIndex <= 0) {
    return `rgb(${PRESSURE_STOPS[0].color.join(' ')})`
  }

  const prev = PRESSURE_STOPS[nextIndex - 1]
  const next = PRESSURE_STOPS[nextIndex]
  const amount = (t - prev.t) / Math.max(next.t - prev.t, 0.000001)

  return `rgb(${interpolateColor(prev.color, next.color, amount).join(' ')})`
}

export function interpolateColor(a: number[], b: number[], amount: number) {
  return a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount))
}

export function contrastIntensity(raw: number) {
  return Math.pow(clamp(raw, 0, 1), 0.68)
}
