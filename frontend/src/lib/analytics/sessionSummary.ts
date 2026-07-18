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
  excludedEpisodeIndices: number[]
}

/** Default CEMRR weights (mirror backend DEFAULT_PARAMETERS.weights). */
const CLINICAL_WEIGHTS: Record<SessionAspectKey, number> = {
  symmetry: 0.25,
  stability: 0.15,
  support: 0.2,
  efficiency: 0.2,
  strength: 0.2,
}

export function excludedEpisodeIndexes(
  analyticsConfig: { excluded_episode_indexes?: number[] | null } | null | undefined,
): Set<number> {
  const raw = analyticsConfig?.excluded_episode_indexes
  if (!Array.isArray(raw)) return new Set()
  return new Set(
    raw.filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0),
  )
}

function avgField(
  episodes: SessionAnalyticsSummary[],
  pick: (ep: SessionAnalyticsSummary) => number | null,
): number | null {
  const values = episodes
    .map(pick)
    .filter((v): v is number => v != null && Number.isFinite(v))
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function weightedGri(aspects: Record<SessionAspectKey, number | null>): number | null {
  let total = 0
  for (const key of SESSION_ASPECT_KEYS) {
    const value = aspects[key]
    if (value == null || !Number.isFinite(value)) return null
    total += value * CLINICAL_WEIGHTS[key]
  }
  return total
}

/** Clinical session summary: average only episodes not in excluded indexes. */
export function clinicalSessionSummary(
  episodes: SessionAnalyticsSummary[],
  excluded: Set<number>,
): SessionAnalyticsSummary | null {
  const included = episodes.filter(
    (ep) => ep.episodeIndex != null && !excluded.has(ep.episodeIndex),
  )
  if (!included.length) return null

  const aspects: Record<SessionAspectKey, number | null> = {
    symmetry: avgField(included, (ep) => ep.aspects.symmetry),
    stability: avgField(included, (ep) => ep.aspects.stability),
    support: avgField(included, (ep) => ep.aspects.support),
    efficiency: avgField(included, (ep) => ep.aspects.efficiency),
    strength: avgField(included, (ep) => ep.aspects.strength),
  }

  const durationSum = included.reduce((acc, ep) => {
    return ep.durationS != null && Number.isFinite(ep.durationS) ? acc + ep.durationS : acc
  }, 0)

  return {
    labelKey: 'session',
    episodeIndex: null,
    durationS: durationSum > 0 ? durationSum : null,
    episodeCount: included.length,
    cadenceStepsPerMin: avgField(included, (ep) => ep.cadenceStepsPerMin),
    strideTimeLeftS: avgField(included, (ep) => ep.strideTimeLeftS),
    strideTimeRightS: avgField(included, (ep) => ep.strideTimeRightS),
    strideTimeSiPct: avgField(included, (ep) => ep.strideTimeSiPct),
    stepLengthLeftM: avgField(included, (ep) => ep.stepLengthLeftM),
    stepLengthRightM: avgField(included, (ep) => ep.stepLengthRightM),
    stepLengthSiPct: avgField(included, (ep) => ep.stepLengthSiPct),
    strideLengthMeanM: avgField(included, (ep) => ep.strideLengthMeanM),
    gri: weightedGri(aspects),
    aspects,
  }
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

  // telemetry_only_calculator episodes use the same shape as its session object.
  if (isRecord(raw.duration) || isRecord(raw.kinematics)) {
    return parseTelemetrySummary(raw, 'episode', asNumber(raw.index), null)
  }

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

function parseTelemetrySummary(
  raw: Record<string, unknown>,
  labelKey: 'session' | 'episode',
  episodeIndex: number | null,
  episodeCount: number | null,
): SessionAnalyticsSummary {
  const duration = isRecord(raw.duration) ? raw.duration : {}
  const controller = isRecord(raw.controller) ? raw.controller : {}
  const kinematics = isRecord(raw.kinematics) ? raw.kinematics : {}
  const stepLength = isRecord(kinematics.stepLength) ? kinematics.stepLength : {}
  const symmetry = isRecord(raw.symmetry) ? raw.symmetry : {}
  return {
    labelKey,
    episodeIndex: episodeIndex == null ? null : Math.trunc(episodeIndex),
    durationS: asNumber(duration.recordedS) ?? asNumber(duration.wallClockS),
    episodeCount,
    cadenceStepsPerMin: asNumber(controller.commandedCadenceStepsMin),
    strideTimeLeftS: null,
    strideTimeRightS: null,
    strideTimeSiPct: null,
    stepLengthLeftM: asNumber(stepLength.leftM),
    stepLengthRightM: asNumber(stepLength.rightM),
    stepLengthSiPct: asNumber(symmetry.romSiHipPct),
    strideLengthMeanM: null,
    gri: null,
    aspects: emptyAspects(),
  }
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
    ? (isRecord(sessionRoot.duration) || isRecord(sessionRoot.kinematics)
      ? parseTelemetrySummary(
          sessionRoot,
          'session',
          null,
          asNumber(sessionRoot.episodeCount) ?? episodes.length,
        )
      : parseSessionSummary(sessionRoot, episodes.length || asNumber(sessionRoot.episodeCount)))
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
    excludedEpisodeIndices: Array.isArray(root.excludedEpisodeIndices)
      ? root.excludedEpisodeIndices
          .map(asNumber)
          .filter((value): value is number => value != null)
          .map(Math.trunc)
      : [],
  }
}

/** @deprecated Prefer parseSessionAnalyticsBundle */
export function parseSessionAnalyticsSummary(
  analyticsMetrics: unknown,
): SessionAnalyticsSummary | null {
  return parseSessionAnalyticsBundle(analyticsMetrics)?.session ?? null
}
