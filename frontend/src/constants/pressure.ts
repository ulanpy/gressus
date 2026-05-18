export const PRESSURE_LEVELS = {
  light: 45,
  strong: 160,
}
export const FALLBACK_FOOT_PATH =
  'M50 2 C63 2 75 13 80 29 C88 54 78 88 61 97 C54 101 44 101 37 97 C20 88 12 55 20 30 C25 14 37 2 50 2 Z'

export const PRESSURE_STOPS = [
  { t: 0, color: [245, 248, 252] },
  { t: 0.1, color: [100, 190, 245] },
  { t: 0.28, color: [30, 175, 155] },
  { t: 0.48, color: [255, 235, 70] },
  { t: 0.68, color: [255, 145, 35] },
  { t: 1, color: [225, 45, 30] },
] satisfies { t: number; color: [number, number, number] }[]
