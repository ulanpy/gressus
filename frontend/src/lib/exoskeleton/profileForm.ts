export type GaitProfile = {
  id: string
  name: string
  description: string
  profileJson: string
  baselineRequired: boolean
}

export type ExoParams = {
  cps: number
  amp_r: number
  amp_l: number
  assist: number
}

export const DEFAULT_EXO_PARAMS: ExoParams = { cps: 0.36, amp_r: 0.5, amp_l: 0.5, assist: 0.5 }

export type RomMap = Record<string, [number, number]>
export type EnableMap = Record<string, boolean>
export type ExoMode = 'position' | 'torque'

export const DEFAULT_EXO_MODE: ExoMode = 'position'
export const DEFAULT_EXO_AAN = false
export const DEFAULT_EXO_ROM: RomMap = {
  '0': [-18, 25],
  '1': [-6, 31],
  '2': [-18, 25],
  '3': [-6, 31],
}
export const DEFAULT_EXO_ENABLE: EnableMap = { '0': true, '1': true, '2': true, '3': true }

export const EXO_JOINTS: { idx: string; label: string }[] = [
  { idx: '0', label: 'R-Hip' },
  { idx: '1', label: 'R-Knee' },
  { idx: '2', label: 'L-Hip' },
  { idx: '3', label: 'L-Knee' },
]

export type ExoStructural = {
  mode: ExoMode
  aan: boolean
  rom: RomMap
  enable: EnableMap
}

export const DEFAULT_EXO_STRUCTURAL: ExoStructural = {
  mode: DEFAULT_EXO_MODE,
  aan: DEFAULT_EXO_AAN,
  rom: DEFAULT_EXO_ROM,
  enable: DEFAULT_EXO_ENABLE,
}

export const EXO_PARAM_FIELDS: { key: keyof ExoParams; label: string; step: number }[] = [
  { key: 'cps', label: 'CPS (скорость)', step: 0.01 },
  { key: 'assist', label: 'Assist', step: 0.05 },
  { key: 'amp_r', label: 'Amplitude R', step: 0.05 },
  { key: 'amp_l', label: 'Amplitude L', step: 0.05 },
]

export function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function parseStructural(src: Record<string, unknown>): ExoStructural {
  const srcRom = (src.rom ?? {}) as Record<string, unknown>
  const srcEnable = (src.enable ?? {}) as Record<string, unknown>
  const rom: RomMap = {}
  const enable: EnableMap = {}
  for (const { idx } of EXO_JOINTS) {
    const r = srcRom[idx]
    const dflt = DEFAULT_EXO_ROM[idx]
    rom[idx] = Array.isArray(r) ? [toNumber(r[0], dflt[0]), toNumber(r[1], dflt[1])] : dflt
    const e = srcEnable[idx]
    enable[idx] = typeof e === 'boolean' ? e : DEFAULT_EXO_ENABLE[idx]
  }
  return {
    mode: src.mode === 'torque' ? 'torque' : DEFAULT_EXO_MODE,
    aan: typeof src.aan === 'boolean' ? src.aan : DEFAULT_EXO_AAN,
    rom,
    enable,
  }
}

export function parseStoredProfile(profileJson: string): {
  params: ExoParams
  extras: Record<string, unknown>
  hasCoeffs: boolean
} | null {
  try {
    const parsed = JSON.parse(profileJson) as Record<string, unknown>
    const inner =
      parsed.profile && typeof parsed.profile === 'object'
        ? (parsed.profile as Record<string, unknown>)
        : parsed
    return {
      params: {
        cps: toNumber(inner.cps, DEFAULT_EXO_PARAMS.cps),
        amp_r: toNumber(inner.amp_r, DEFAULT_EXO_PARAMS.amp_r),
        amp_l: toNumber(inner.amp_l, DEFAULT_EXO_PARAMS.amp_l),
        assist: toNumber(inner.assist, DEFAULT_EXO_PARAMS.assist),
      },
      extras: inner,
      hasCoeffs: Array.isArray(inner.coeffs) && inner.coeffs.length > 0,
    }
  } catch {
    return null
  }
}

export function buildProfileJson(
  patient: { id: string; display_name: string } | undefined,
  params: ExoParams,
  structural: ExoStructural,
  extras: Record<string, unknown>,
  hasStoredCoeffs: boolean,
): string {
  const { coeffs: _coeffs, meta: _meta, rom: _rom, enable: _enable, mode: _mode, aan: _aan, ...carry } =
    extras
  const profile: Record<string, unknown> = {
    ...carry,
    mode: structural.mode,
    aan: structural.aan,
    rom: structural.rom,
    enable: structural.enable,
    patient_id: patient?.id,
    patient_name: patient?.display_name,
    cps: params.cps,
    amp_r: params.amp_r,
    amp_l: params.amp_l,
    assist: params.assist,
  }
  profile.coeffs = hasStoredCoeffs ? extras.coeffs : []
  return JSON.stringify(profile, null, 2)
}
