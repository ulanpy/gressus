import type { StepEmit, StepQuality, StepSide, TreeKind, TreeStage } from '../../types/garden'

export const GARDEN_TREE_ORDER: readonly TreeKind[] = ['apple', 'sakura', 'birch']

export const GARDEN_CONFIG = {
  /** Min total kPa (L+R) — ignore frames with no real contact. */
  minTotalKpa: 40,
  trigger: {
    /** Weight must lean this far (|balance|) before a transfer can count. */
    enterThreshold: 0.20,
    /** Balance must cross back past this to register a step. */
    crossHysteresis: 0.08,
    minIntervalMs: 240,
    historyMs: 500,
  },
  symmetry: {
    greatThreshold: 0.72,
    goodThreshold: 0.58,
    okThreshold: 0.42,
  },
  charge: {
    great: 6,
    good: 4,
    ok: 2,
    weak: 1,
  },
  stageThresholds: [0, 8, 18, 32, 52, 75] as const,
  harvestDurationMs: 1800,
  appleAppearStartStage: 5 as TreeStage,
} as const

export function balanceFrom(leftSum: number, rightSum: number): number {
  const total = leftSum + rightSum
  if (total < 1e-6) return 0
  return (rightSum - leftSum) / total
}

export function leftShareFrom(leftSum: number, rightSum: number): number {
  const total = leftSum + rightSum
  if (total < 1e-6) return 0.5
  return leftSum / total
}

/**
 * Symmetry for a weight-transfer step.
 * Real gait rarely averages 50/50 over the window — we reward visible
 * L↔R swing and passing near center, not a perfect mean.
 */
export function symmetryFromTransition(shares: number[], balances: number[]): number {
  if (shares.length === 0) return 0.55

  const recentN = Math.max(3, Math.ceil(shares.length * 0.55))
  const recentShares = shares.slice(-recentN)
  const recentBalances = balances.slice(-recentN)

  const mean = recentShares.reduce((a, b) => a + b, 0) / recentShares.length
  const swing = Math.max(...recentShares) - Math.min(...recentShares)
  const balanceSwing = Math.max(...recentBalances) - Math.min(...recentBalances)
  const crossedCenter =
    Math.min(...recentShares) < 0.48 && Math.max(...recentShares) > 0.52
  const crossedZero =
    Math.min(...recentBalances) < 0.06 && Math.max(...recentBalances) > -0.06

  const meanScore = Math.max(0, 1 - 2 * Math.abs(mean - 0.5))
  const swingScore = Math.min(1, swing / 0.26)
  const balanceScore = Math.min(1, balanceSwing / 0.38)

  let score = 0.36 + meanScore * 0.16 + swingScore * 0.3 + balanceScore * 0.24
  if (crossedCenter || crossedZero) score += 0.14

  return Math.min(1, score)
}

export function qualityFromSymmetry(symmetry: number): StepQuality {
  const s = GARDEN_CONFIG.symmetry
  if (symmetry >= s.greatThreshold) return 'great'
  if (symmetry >= s.goodThreshold) return 'good'
  if (symmetry >= s.okThreshold) return 'ok'
  return 'weak'
}

export function chargeFromQuality(quality: StepQuality): number {
  return GARDEN_CONFIG.charge[quality]
}

export function stageFromCharge(charge: number): { stage: TreeStage; progress: number } {
  const thresholds = GARDEN_CONFIG.stageThresholds
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (charge >= thresholds[i]) {
      const lower = thresholds[i]
      const upper = thresholds[i + 1] ?? lower
      const span = Math.max(upper - lower, 1)
      const progress = Math.min(1, (charge - lower) / span)
      return { stage: i as TreeStage, progress }
    }
  }
  return { stage: 0, progress: 0 }
}

export function isFullyGrown(charge: number): boolean {
  const max = GARDEN_CONFIG.stageThresholds[GARDEN_CONFIG.stageThresholds.length - 1]
  return charge >= max
}

export type StepDetectorState = {
  history: Array<{ t: number; leftShare: number; balance: number }>
  lastSide: StepSide | null
  lastStepAt: number
  armed: StepSide | null
}

export function createStepDetectorState(): StepDetectorState {
  return { history: [], lastSide: null, lastStepAt: 0, armed: null }
}

export function pushBalanceSample(
  state: StepDetectorState,
  nowMs: number,
  leftSum: number,
  rightSum: number,
): StepEmit | null {
  if (leftSum + rightSum < GARDEN_CONFIG.minTotalKpa) return null

  const b = balanceFrom(leftSum, rightSum)
  const share = leftShareFrom(leftSum, rightSum)
  state.history.push({ t: nowMs, leftShare: share, balance: b })
  const horizon = GARDEN_CONFIG.trigger.historyMs * 2
  const cutoff = nowMs - horizon
  while (state.history.length > 0 && state.history[0].t < cutoff) {
    state.history.shift()
  }

  const { enterThreshold, crossHysteresis } = GARDEN_CONFIG.trigger
  if (b > enterThreshold) state.armed = 'right'
  else if (b < -enterThreshold) state.armed = 'left'

  if (state.armed === 'right' && b < -crossHysteresis) {
    return tryEmit(state, nowMs, 'left')
  }
  if (state.armed === 'left' && b > crossHysteresis) {
    return tryEmit(state, nowMs, 'right')
  }
  return null
}

export function manualEmit(state: StepDetectorState, nowMs: number): StepEmit {
  const windowStart = nowMs - GARDEN_CONFIG.trigger.historyMs
  const windowSamples = state.history.filter((s) => s.t >= windowStart)
  const shares = windowSamples.map((s) => s.leftShare)
  const balances = windowSamples.map((s) => s.balance)
  const symmetry =
    shares.length > 0 ? symmetryFromTransition(shares, balances) : 0.75
  const intervalMs = state.lastStepAt > 0 ? nowMs - state.lastStepAt : 0
  const side: StepSide = state.lastSide === 'left' ? 'right' : 'left'
  state.lastSide = side
  state.lastStepAt = nowMs
  state.armed = null
  return { side, symmetry, intervalMs }
}

function tryEmit(state: StepDetectorState, nowMs: number, side: StepSide): StepEmit | null {
  const interval = state.lastStepAt > 0 ? nowMs - state.lastStepAt : 0
  if (state.lastStepAt > 0 && interval < GARDEN_CONFIG.trigger.minIntervalMs) return null
  const windowStart = nowMs - GARDEN_CONFIG.trigger.historyMs
  const windowSamples = state.history.filter((s) => s.t >= windowStart)
  const shares = windowSamples.map((s) => s.leftShare)
  const balances = windowSamples.map((s) => s.balance)
  const symmetry = symmetryFromTransition(shares, balances)
  state.lastSide = side
  state.lastStepAt = nowMs
  state.armed = null
  return { side, symmetry, intervalMs: interval }
}
