/** Legacy progress analytics types (upload flow). */

export type ProgressSummary = {
  baseline: {
    session: number
    date: string
    gaitScore: number
    walkingSpeed: number
    cadence: number
    leftAvgPressure: number
    rightAvgPressure: number
  }
  latest: {
    session: number
    date: string
    gaitScore: number
    walkingSpeed: number
    cadence: number
    leftAvgPressure: number
    rightAvgPressure: number
  }
}

export type TherapyRecommendation = {
  id: string
  label?: string
  detail?: string
  tone?: 'focus' | 'steady' | 'positive'
}
