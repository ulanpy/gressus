import type { GameLaunchParams } from '../types/runtime'

/** Default = slow mode (safe baseline for gait training). */
export const GAME_DEFAULTS: GameLaunchParams = {
  display: null,
  outputRotation: 270,
  insoleThresholdKpa: 8,
  noInsole: false,
  demo: false,
  speed: 0.35,
  stepTimeS: 2.5,
}

/**
 * Tile spawn interval must clear same-lane overlap (lanes alternate every step):
 *   2 × stepTimeS × (speed × 420 px/s) ≥ play_h × (TILE_HEIGHT + SAME_LANE_GAP)
 * With typical play_h, speed 0.35 needs stepTimeS ≳ 1.4 s; 2.5 s is comfortable.
 */
export const GAME_PRESETS: { id: string; label: string; values: Partial<GameLaunchParams> }[] = [
  {
    id: 'slow',
    label: 'slow',
    values: { speed: 0.45, stepTimeS: 2.5, insoleThresholdKpa: 8, noInsole: false },
  },
  {
    id: 'medium',
    label: 'medium',
    values: { speed: 0.75, stepTimeS: 1.6, insoleThresholdKpa: 8, noInsole: false },
  },
  {
    id: 'fast',
    label: 'fast',
    values: { speed: 1.10, stepTimeS: 1.0, insoleThresholdKpa: 10, noInsole: false },
  },
]
