export type StepSide = 'left' | 'right'

export type StepQuality = 'great' | 'good' | 'ok' | 'weak'

export type StepEmit = {
  side: StepSide
  symmetry: number
  intervalMs: number
}

export type TreeStage = 0 | 1 | 2 | 3 | 4 | 5

export type TreeKind = 'apple' | 'sakura' | 'birch'

export type HarvestKind = 'apple' | 'cherry' | 'leaf'

export type GardenHud = {
  cyclesGrown: number
  activeTree: TreeKind
  stage: TreeStage
  stageProgress: number
  stepCount: number
  meanSymmetry: number
  lastQuality: StepQuality | null
  recentChargePerStep: number
}
