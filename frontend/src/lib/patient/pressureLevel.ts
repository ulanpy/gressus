import type { FootFrame } from '../../types/insole'
import { PRESSURE_LEVELS } from '../../constants/pressure'


export function patientPressureLevel(frame: FootFrame) {
  if (!frame.stats.pressed) {
    return 'waiting'
  }

  if (frame.stats.maxKpa < PRESSURE_LEVELS.light) {
    return 'light'
  }

  if (frame.stats.maxKpa > PRESSURE_LEVELS.strong) {
    return 'strong'
  }

  return 'steady'
}
