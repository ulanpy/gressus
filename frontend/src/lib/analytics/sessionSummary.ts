export type SessionAspectKey = 'symmetry' | 'stability' | 'support' | 'efficiency' | 'strength'

export const SESSION_ASPECT_KEYS: SessionAspectKey[] = [
  'symmetry',
  'stability',
  'support',
  'efficiency',
  'strength',
]

export type SessionAnalyticsSummary = {
  labelKey: 'session' | 'episode'
  episodeIndex: number | null
  durationS: number | null
  episodeCount: number | null
  cadenceStepsPerMin: number | null
  strideTimeLeftS: number | null
  strideTimeRightS: number | null
  strideTimeSiPct: number | null
  stepLengthLeftM: number | null
  stepLengthRightM: number | null
  stepLengthSiPct: number | null
  strideLengthMeanM: number | null
  gri: number | null
  aspects: Record<SessionAspectKey, number | null>
}

export type SessionAnalyticsBundle = {
  session: SessionAnalyticsSummary
  episodes: SessionAnalyticsSummary[]
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

function nestedMean(parent: Record<string, unknown>, key: string): number | null {
  const child = parent[key]
  if (!isRecord(child)) return null
  return asNumber(child.mean)
}

function emptyAspects(): Record<SessionAspectKey, number | null> {
  return {
    symmetry: null,
    stability: null,
    support: null,
    efficiency: null,
    strength: null,
  }
}

function parseAspects(scores: Record<string, unknown>): Record<SessionAspectKey, number | null> {
  return {
    symmetry: asNumber(scores.symmetry),
    stability: asNumber(scores.stability),
    support: asNumber(scores.support),
    efficiency: asNumber(scores.efficiency),
    strength: asNumber(scores.strength),
  }
}

function hasSummarySignal(summary: SessionAnalyticsSummary): boolean {
  return (
    summary.cadenceStepsPerMin != null ||
    summary.gri != null ||
    SESSION_ASPECT_KEYS.some((key) => summary.aspects[key] != null) ||
    summary.strideTimeLeftS != null ||
    summary.stepLengthLeftM != null ||
    summary.durationS != null
  )
}

function getAnalyticsRoot(analyticsMetrics: unknown): Record<string, unknown> | null {
  if (!isRecord(analyticsMetrics)) return null
  const root = isRecord(analyticsMetrics.analytics)
    ? analyticsMetrics.analytics
    : analyticsMetrics
  return isRecord(root) ? root : null
}

function parseSessionSummary(
  session: Record<string, unknown>,
  episodeCount: number | null,
): SessionAnalyticsSummary | null {
  const strideTime = isRecord(session.strideTime) ? session.strideTime : {}
  const stepLength = isRecord(session.stepLength) ? session.stepLength : {}
  const cemrr = isRecord(session.cemrrScores) ? session.cemrrScores : {}
  const aspects = parseAspects(cemrr)

  const summary: SessionAnalyticsSummary = {
    labelKey: 'session',
    episodeIndex: null,
    durationS: asNumber(session.durationS),
    episodeCount: episodeCount ?? asNumber(session.episodeCount),
    cadenceStepsPerMin: asNumber(session.cadenceStepsPerMin),
    strideTimeLeftS: asNumber(strideTime.leftMeanS),
    strideTimeRightS: asNumber(strideTime.rightMeanS),
    strideTimeSiPct: asNumber(strideTime.symmetryIndexPct),
    stepLengthLeftM: asNumber(stepLength.leftMeanM),
    stepLengthRightM: asNumber(stepLength.rightMeanM),
    stepLengthSiPct: asNumber(stepLength.symmetryIndexPct),
    strideLengthMeanM: asNumber(session.strideLengthMeanM),
    gri: asNumber(cemrr.gri),
    aspects,
  }

  return hasSummarySignal(summary) ? summary : null
}

function parseEpisodeSummary(raw: unknown): SessionAnalyticsSummary | null {
  if (!isRecord(raw)) return null

  const timing = isRecord(raw.timing) ? raw.timing : {}
  const left = isRecord(timing.left) ? timing.left : {}
  const right = isRecord(timing.right) ? timing.right : {}
  const spatial = isRecord(raw.spatial) ? raw.spatial : {}
  const scores = isRecord(raw.scores) ? raw.scores : {}
  const aspects = parseAspects(scores)
  const episodeIndex = asNumber(raw.index)

  const summary: SessionAnalyticsSummary = {
    labelKey: 'episode',
    episodeIndex: episodeIndex == null ? null : Math.trunc(episodeIndex),
    durationS: asNumber(raw.durationS),
    episodeCount: null,
    cadenceStepsPerMin: asNumber(timing.cadenceStepsPerMin),
    strideTimeLeftS: nestedMean(left, 'strideTime'),
    strideTimeRightS: nestedMean(right, 'strideTime'),
    strideTimeSiPct: asNumber(timing.strideTimeSymmetryIndexPct),
    stepLengthLeftM: nestedMean(spatial, 'leftStepLengthM'),
    stepLengthRightM: nestedMean(spatial, 'rightStepLengthM'),
    stepLengthSiPct: asNumber(spatial.stepLengthSymmetryIndexPct),
    strideLengthMeanM: nestedMean(spatial, 'strideLengthM'),
    gri: asNumber(scores.gri),
    aspects: Object.keys(scores).length ? aspects : emptyAspects(),
  }

  return hasSummarySignal(summary) ? summary : null
}

/** Session aggregate + per-episode summaries from the analytics worker blob. */
export function parseSessionAnalyticsBundle(
  analyticsMetrics: unknown,
): SessionAnalyticsBundle | null {
  const root = getAnalyticsRoot(analyticsMetrics)
  if (!root) return null

  const sessionRoot = isRecord(root.session) ? root.session : null
  const episodesRaw = Array.isArray(root.episodes) ? root.episodes : []
  const episodes = episodesRaw
    .map(parseEpisodeSummary)
    .filter((ep): ep is SessionAnalyticsSummary => ep != null)
    .sort((a, b) => (a.episodeIndex ?? 0) - (b.episodeIndex ?? 0))

  const session = sessionRoot
    ? parseSessionSummary(sessionRoot, episodes.length || asNumber(sessionRoot.episodeCount))
    : null

  if (!session && episodes.length === 0) return null

  return {
    session:
      session ??
      ({
        labelKey: 'session',
        episodeIndex: null,
        durationS: null,
        episodeCount: episodes.length,
        cadenceStepsPerMin: null,
        strideTimeLeftS: null,
        strideTimeRightS: null,
        strideTimeSiPct: null,
        stepLengthLeftM: null,
        stepLengthRightM: null,
        stepLengthSiPct: null,
        strideLengthMeanM: null,
        gri: null,
        aspects: emptyAspects(),
      } satisfies SessionAnalyticsSummary),
    episodes,
  }
}

/** @deprecated Prefer parseSessionAnalyticsBundle */
export function parseSessionAnalyticsSummary(
  analyticsMetrics: unknown,
): SessionAnalyticsSummary | null {
  return parseSessionAnalyticsBundle(analyticsMetrics)?.session ?? null
}
