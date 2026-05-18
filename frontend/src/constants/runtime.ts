import type { GameLaunchParams } from '../types/runtime'

export const GAME_DEFAULTS: GameLaunchParams = {
  display: null,
  outputRotation: 270,
  insoleThresholdKpa: 8,
  speed: 0.35,
  stepTimeS: 1.2,
}

export const GAME_PRESETS: { id: string; label: string; values: Partial<GameLaunchParams> }[] = [
  { id: 'demo', label: 'demo', values: { speed: 0.35, stepTimeS: 1.2, insoleThresholdKpa: 8 } },
  { id: 'easy', label: 'easy', values: { speed: 0.22, stepTimeS: 1.6, insoleThresholdKpa: 6 } },
  { id: 'fast', label: 'fast', values: { speed: 0.75, stepTimeS: 0.8, insoleThresholdKpa: 10 } },
]
