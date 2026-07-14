export const GAIT_CYCLE_JOINTS = ['HR', 'HL', 'KR', 'KL'] as const

export type GaitCycleJointId = (typeof GAIT_CYCLE_JOINTS)[number]

export type AverageGaitCyclePoint = {
  phasePct: number
  refDeg: number | null
  actualDeg: number | null
  errorDeg: number | null
}

export type AverageGaitCycleJoint = {
  id: GaitCycleJointId
  label: string
  cycleCount: number
  summary: {
    rmseDeg: number | null
    maeDeg: number | null
    maxErrorDeg: number | null
    compliance: number | null
  }
  points: AverageGaitCyclePoint[]
}

export type AverageGaitCycleProfile = {
  cycleIntervalCount: number
  eventSource: string | null
  joints: AverageGaitCycleJoint[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parsePoint(raw: unknown): AverageGaitCyclePoint | null {
  if (!isRecord(raw)) return null
  const phasePct = asNumber(raw.phasePct)
  if (phasePct == null) return null
  return {
    phasePct,
    refDeg: asNumber(raw.refDeg),
    actualDeg: asNumber(raw.actualDeg),
    errorDeg: asNumber(raw.errorDeg),
  }
}

function parseJoint(id: GaitCycleJointId, raw: unknown): AverageGaitCycleJoint | null {
  if (!isRecord(raw)) return null
  const pointsRaw = Array.isArray(raw.points) ? raw.points : []
  const points = pointsRaw.map(parsePoint).filter((p): p is AverageGaitCyclePoint => p != null)
  if (points.length === 0) return null

  const summary = isRecord(raw.summary) ? raw.summary : {}
  return {
    id,
    label: typeof raw.label === 'string' ? raw.label : id,
    cycleCount: asNumber(raw.cycleCount) ?? 0,
    summary: {
      rmseDeg: asNumber(summary.rmseDeg),
      maeDeg: asNumber(summary.maeDeg),
      maxErrorDeg: asNumber(summary.maxErrorDeg),
      compliance: asNumber(summary.compliance),
    },
    points,
  }
}

/** Locate averageGaitCycle inside the worker blob (`{ analytics: { session: ... } }`). */
export function parseAverageGaitCycle(
  analyticsMetrics: unknown,
): AverageGaitCycleProfile | null {
  if (!isRecord(analyticsMetrics)) return null

  const root = isRecord(analyticsMetrics.analytics)
    ? analyticsMetrics.analytics
    : analyticsMetrics
  if (!isRecord(root)) return null

  const session = isRecord(root.session) ? root.session : null
  if (!session) return null

  const tracking = isRecord(session.tracking) ? session.tracking : null
  if (!tracking) return null

  const average = isRecord(tracking.averageGaitCycle) ? tracking.averageGaitCycle : null
  if (!average) return null

  const jointsRaw = isRecord(average.joints) ? average.joints : null
  if (!jointsRaw) return null

  const joints = GAIT_CYCLE_JOINTS.map((id) => parseJoint(id, jointsRaw[id])).filter(
    (joint): joint is AverageGaitCycleJoint => joint != null,
  )
  if (joints.length === 0) return null

  return {
    cycleIntervalCount: asNumber(average.cycleIntervalCount) ?? 0,
    eventSource: typeof average.eventSource === 'string' ? average.eventSource : null,
    joints,
  }
}
