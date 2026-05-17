export type SessionMetrics = {
  session: number
  date: string
  cadence: number
  walkingSpeed: number
  leftAvgPressure: number
  rightAvgPressure: number
  symmetryScore: number
  stabilityScore: number
  variabilityScore: number
  gaitScore: number
}

export type ProgressSummary = {
  baseline: SessionMetrics
  latest: SessionMetrics
  gaitScoreChange: number
  gaitScorePercent: number
  symmetryChange: number
  symmetryPercent: number
  stabilityChange: number
  stabilityPercent: number
  sessionsCompleted: number
}

export type TherapyRecommendation = {
  id: string
  label: string
  detail: string
  badge: string
  tone: 'focus' | 'steady' | 'positive'
}

export function getMockSessionHistory(): SessionMetrics[] {
  return [
    {
      session: 1,
      date: '2026-04-03',
      cadence: 88,
      walkingSpeed: 0.72,
      leftAvgPressure: 166,
      rightAvgPressure: 139,
      symmetryScore: 61,
      stabilityScore: 64,
      variabilityScore: 31,
      gaitScore: 58,
    },
    {
      session: 2,
      date: '2026-04-08',
      cadence: 91,
      walkingSpeed: 0.76,
      leftAvgPressure: 160,
      rightAvgPressure: 144,
      symmetryScore: 66,
      stabilityScore: 68,
      variabilityScore: 28,
      gaitScore: 63,
    },
    {
      session: 3,
      date: '2026-04-15',
      cadence: 90,
      walkingSpeed: 0.78,
      leftAvgPressure: 158,
      rightAvgPressure: 147,
      symmetryScore: 69,
      stabilityScore: 67,
      variabilityScore: 29,
      gaitScore: 65,
    },
    {
      session: 4,
      date: '2026-04-22',
      cadence: 94,
      walkingSpeed: 0.84,
      leftAvgPressure: 153,
      rightAvgPressure: 150,
      symmetryScore: 74,
      stabilityScore: 72,
      variabilityScore: 24,
      gaitScore: 71,
    },
    {
      session: 5,
      date: '2026-04-29',
      cadence: 96,
      walkingSpeed: 0.87,
      leftAvgPressure: 151,
      rightAvgPressure: 149,
      symmetryScore: 77,
      stabilityScore: 76,
      variabilityScore: 22,
      gaitScore: 75,
    },
    {
      session: 6,
      date: '2026-05-06',
      cadence: 95,
      walkingSpeed: 0.86,
      leftAvgPressure: 154,
      rightAvgPressure: 148,
      symmetryScore: 75,
      stabilityScore: 78,
      variabilityScore: 23,
      gaitScore: 76,
    },
    {
      session: 7,
      date: '2026-05-13',
      cadence: 99,
      walkingSpeed: 0.92,
      leftAvgPressure: 150,
      rightAvgPressure: 151,
      symmetryScore: 81,
      stabilityScore: 82,
      variabilityScore: 19,
      gaitScore: 82,
    },
  ]
}

export function calculateProgressSummary(metrics: SessionMetrics[]): ProgressSummary {
  const baseline = metrics[0]
  const latest = metrics[metrics.length - 1]

  return {
    baseline,
    latest,
    gaitScoreChange: latest.gaitScore - baseline.gaitScore,
    gaitScorePercent: percentChange(baseline.gaitScore, latest.gaitScore),
    symmetryChange: latest.symmetryScore - baseline.symmetryScore,
    symmetryPercent: percentChange(baseline.symmetryScore, latest.symmetryScore),
    stabilityChange: latest.stabilityScore - baseline.stabilityScore,
    stabilityPercent: percentChange(baseline.stabilityScore, latest.stabilityScore),
    sessionsCompleted: metrics.length,
  }
}

export function generateTherapyRecommendations(metrics: SessionMetrics[]): TherapyRecommendation[] {
  const summary = calculateProgressSummary(metrics)
  const { baseline, latest } = summary
  const loadDifference = Math.abs(latest.leftAvgPressure - latest.rightAvgPressure)
  const baselineLoadDifference = Math.abs(baseline.leftAvgPressure - baseline.rightAvgPressure)
  const recommendations: TherapyRecommendation[] = []

  if (latest.symmetryScore < 75) {
    recommendations.push({
      id: 'symmetry',
      label: 'Symmetry feedback',
      detail: 'Use step-to-step cues to reduce left and right stance timing differences.',
      badge: 'Focus',
      tone: 'focus',
    })
  }

  if (latest.stabilityScore < 75) {
    recommendations.push({
      id: 'stability',
      label: 'Balance and stance control',
      detail: 'Continue slow stance holds and controlled weight shifts before speed progression.',
      badge: 'Focus',
      tone: 'focus',
    })
  }

  if (latest.variabilityScore > 25) {
    recommendations.push({
      id: 'variability',
      label: 'Rhythm consistency',
      detail: 'Keep treadmill speed controlled and add cadence rhythm work for steadier steps.',
      badge: 'Monitor',
      tone: 'steady',
    })
  }

  if (loadDifference > 10) {
    recommendations.push({
      id: 'load-balance',
      label: 'Plantar load redistribution',
      detail: 'Add feedback for softer loading on the higher-pressure side during mid-stance.',
      badge: 'Monitor',
      tone: 'steady',
    })
  }

  if (summary.gaitScorePercent >= 25) {
    recommendations.push({
      id: 'progression',
      label: 'Continue current progression',
      detail: 'Gait score has improved meaningfully from baseline; maintain progression with light challenge increases.',
      badge: 'Improving',
      tone: 'positive',
    })
  }

  if (loadDifference <= 10 && baselineLoadDifference - loadDifference >= 10) {
    recommendations.push({
      id: 'load-gain',
      label: 'Load balance gains',
      detail: 'Left and right loading are now close; preserve this pattern as walking speed increases.',
      badge: 'Improving',
      tone: 'positive',
    })
  }

  return recommendations.slice(0, 4)
}

function percentChange(baseline: number, latest: number) {
  return baseline === 0 ? 0 : ((latest - baseline) / baseline) * 100
}
