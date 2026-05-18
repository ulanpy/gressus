export type CemrrJointKey = 'lh' | 'rh' | 'lk' | 'rk'

export const CEMRR_JOINTS: CemrrJointKey[] = ['lh', 'rh', 'lk', 'rk']

export type CemrrInput = {
  session: number
  legM: number
  vBelt: number
  hsL: number
  toL: number
  hsL2: number
  hsR: number
  toR: number
  hsR2: number
  cvL: number
  cvR: number
  thL: number
  thR: number
  siBase: number
  cvBase: number
  dsrBase: number
  pLTotal: number
  pRTotal: number
  fp: [number, number, number, number]
  fs: [number, number, number, number]
  dTheta: [number, number, number, number]
}

export type CemrrAspectKey = 'S' | 'V' | 'B' | 'E' | 'STR'

export type CemrrResult = {
  session: number
  vBelt: number
  tStanceL: number
  tSwingL: number
  tStanceR: number
  tSwingR: number
  tStride: number
  tDouble: number
  dsr: number
  cadence: number
  stepL: number
  stepR: number
  strideLength: number
  symmetryIndex: number
  cvL: number
  cvR: number
  cvMean: number
  tau: [number, number, number, number]
  ptf: [number, number, number, number]
  kJoints: [number, number, number, number]
  jsiMean: number
  dTheta: [number, number, number, number]
  pL: number
  pR: number
  totalLoad: number
  pLPct: number
  pRPct: number
  ali: number
  aspects: Record<CemrrAspectKey, number>
  gri: number
  efficiency: { speed: number; cadence: number; strideLength: number }
}

export type CemrrRecommendationTone = 'high' | 'mid' | 'low'

export type CemrrRecommendationId =
  | 'bws_hi'
  | 'bws_ok'
  | 'speed_lo'
  | 'sym_lo'
  | 'sym_ok'
  | 'cv_hi'
  | 'exo_lo'
  | 'exo_md'
  | 'exo_hi'
  | 'plat'
  | 'cad_lo'
  | 'ali_lo'
  | 'ali_ok'
  | 'jsi_hi'
  | 'jsi_ok'

export type CemrrRecommendation = {
  id: CemrrRecommendationId
  tone: CemrrRecommendationTone
  vars: Record<string, string | number>
}
