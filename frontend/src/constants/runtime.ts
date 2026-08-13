import type { GameLaunchParams } from '../types/runtime'

export const GAME_DEFAULTS: GameLaunchParams = {
  display: null, outputRotation: 270, insoleThresholdKpa: 8,
  noInsole: false, demo: false, speed: 0.35, stepTimeS: 2.5,
}

export const GAME_PRESETS = [
  { id: 'slow', values: { speed: 0.45, stepTimeS: 2.5, insoleThresholdKpa: 8 } },
  { id: 'medium', values: { speed: 0.75, stepTimeS: 1.6, insoleThresholdKpa: 8 } },
  { id: 'fast', values: { speed: 1.1, stepTimeS: 1, insoleThresholdKpa: 10 } },
] satisfies { id: string; values: Partial<GameLaunchParams> }[]
