import type {
  CemrrRecommendation,
  CemrrRecommendationId,
  CemrrRecommendationTone,
  CemrrResult,
} from '../../types/cemrr'

const TONE_ORDER: Record<CemrrRecommendationTone, number> = {
  high: 0,
  mid: 1,
  low: 2,
}

const TONE_BY_ID: Record<CemrrRecommendationId, CemrrRecommendationTone> = {
  bws_hi: 'high',
  bws_ok: 'low',
  speed_lo: 'high',
  sym_lo: 'high',
  sym_ok: 'low',
  cv_hi: 'mid',
  exo_lo: 'high',
  exo_md: 'mid',
  exo_hi: 'low',
  plat: 'low',
  cad_lo: 'high',
  ali_lo: 'high',
  ali_ok: 'low',
  jsi_hi: 'mid',
  jsi_ok: 'low',
}

export function buildCemrrRecommendations(result: CemrrResult): CemrrRecommendation[] {
  const ids: CemrrRecommendationId[] = []

  ids.push(result.dsr > 28 ? 'bws_hi' : 'bws_ok')
  if (result.vBelt < 0.63) ids.push('speed_lo')
  ids.push(result.symmetryIndex > 10 ? 'sym_lo' : 'sym_ok')
  if (result.cvMean > 3) ids.push('cv_hi')

  if (result.aspects.STR < 0.12) ids.push('exo_lo')
  else if (result.aspects.STR < 0.35) ids.push('exo_md')
  else ids.push('exo_hi')

  if (result.gri > 0.78) ids.push('plat')
  if (result.cadence < 90) ids.push('cad_lo')

  ids.push(result.ali < 0.8 ? 'ali_lo' : 'ali_ok')
  ids.push(result.jsiMean > 0.08 ? 'jsi_hi' : 'jsi_ok')

  const recs: CemrrRecommendation[] = ids.map((id) => ({
    id,
    tone: TONE_BY_ID[id],
    vars: buildVars(id, result),
  }))

  return recs.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
}

function buildVars(id: CemrrRecommendationId, r: CemrrResult): Record<string, string | number> {
  switch (id) {
    case 'bws_hi':
    case 'bws_ok':
      return { v: r.dsr.toFixed(1) }
    case 'speed_lo':
      return { v: r.vBelt.toFixed(2) }
    case 'sym_lo':
    case 'sym_ok':
      return { v: r.symmetryIndex.toFixed(1) }
    case 'cv_hi':
      return { v: r.cvMean.toFixed(2) }
    case 'exo_lo':
    case 'exo_md':
    case 'exo_hi':
      return { v: (r.aspects.STR * 100).toFixed(1) }
    case 'plat':
      return { v: Math.round(r.gri * 100) }
    case 'cad_lo':
      return {
        v: Math.round(r.cadence),
        t: Math.min(Math.round(r.cadence) + 8, 100),
      }
    case 'ali_lo':
    case 'ali_ok':
      return { v: r.ali.toFixed(3), pl: r.pLPct.toFixed(1), pr: r.pRPct.toFixed(1) }
    case 'jsi_hi':
    case 'jsi_ok':
      return { v: r.jsiMean.toFixed(4) }
  }
}

export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{${key}}`,
  )
}
