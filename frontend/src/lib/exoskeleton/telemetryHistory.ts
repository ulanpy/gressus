import type { ExoskeletonTelemetryFrame } from '../../types/exoskeleton'

/** Fixed rolling window shown on the live joint chart. */
export const TELEMETRY_WINDOW_SECONDS = 30

/** How often React state is updated for the chart (keeps re-renders bounded). */
export const TELEMETRY_UI_HZ = 5

/** Hard cap: window × UI rate + small slack. Never grows past this. */
export const TELEMETRY_HISTORY_MAX_POINTS =
  TELEMETRY_WINDOW_SECONDS * TELEMETRY_UI_HZ + TELEMETRY_UI_HZ

export const JOINT_IDS = ['HR', 'KR', 'HL', 'KL'] as const
export type JointId = (typeof JOINT_IDS)[number]

export type TelemetryMetric = 'pos' | 'refPos' | 'vel' | 'measTorque'

export type TelemetryHistoryPoint = {
  at: number
  values: Record<JointId, Record<TelemetryMetric, number>>
}

export function sampleFromFrame(
  frame: ExoskeletonTelemetryFrame,
  at = Date.now(),
): TelemetryHistoryPoint {
  const byName = new Map(frame.joints.map((joint) => [joint.name, joint]))
  const values = {} as TelemetryHistoryPoint['values']
  for (const id of JOINT_IDS) {
    const joint = byName.get(id)
    values[id] = {
      pos: joint?.pos ?? 0,
      refPos: joint?.refPos ?? 0,
      vel: joint?.vel ?? 0,
      measTorque: joint?.measTorque ?? 0,
    }
  }
  return { at, values }
}

/**
 * Append a sample and drop anything outside the fixed window.
 * Capacity is also hard-capped so a stuck clock / burst cannot grow forever.
 */
export function appendTrimmed(
  history: TelemetryHistoryPoint[],
  point: TelemetryHistoryPoint,
  windowSeconds = TELEMETRY_WINDOW_SECONDS,
  maxPoints = TELEMETRY_HISTORY_MAX_POINTS,
): TelemetryHistoryPoint[] {
  const cutoff = point.at - windowSeconds * 1000
  let start = 0
  while (start < history.length && history[start].at < cutoff) start += 1

  const kept = start === 0 ? history : history.slice(start)
  const next = kept.length === 0 ? [point] : [...kept, point]

  if (next.length <= maxPoints) return next
  return next.slice(next.length - maxPoints)
}

/** Snapshot for Recharts: absolute time → seconds-ago within the fixed window. */
export function toChartRows(
  history: TelemetryHistoryPoint[],
  metric: TelemetryMetric,
  now = Date.now(),
  windowSeconds = TELEMETRY_WINDOW_SECONDS,
) {
  const cutoff = now - windowSeconds * 1000
  return history
    .filter((point) => point.at >= cutoff)
    .map((point) => ({
      t: (point.at - cutoff) / 1000,
      HR: point.values.HR[metric],
      KR: point.values.KR[metric],
      HL: point.values.HL[metric],
      KL: point.values.KL[metric],
    }))
}
