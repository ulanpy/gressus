import type { CemrrInput, CemrrResult } from '../../types/cemrr'

const DEG_TO_RAD = Math.PI / 180

export function computeCemrr(input: CemrrInput): CemrrResult {
  const { legM, vBelt } = input

  const tStanceL = input.toL - input.hsL
  const tSwingL = input.hsL2 - input.toL
  const tStride = input.hsL2 - input.hsL
  const tStanceR = input.toR - input.hsR
  const tSwingR = input.hsR2 - input.toR
  const tDouble = Math.max(0, Math.min(input.toL, input.toR) - Math.max(input.hsL, input.hsR))
  const dsr = tStride > 0 ? (tDouble / tStride) * 100 : 0

  const tStepL = input.hsR - input.hsL
  const tStepR = input.hsL2 - input.hsR
  const stepWindow = tStepL + tStepR
  const cadence = stepWindow > 0 ? 60 / (stepWindow / 2) : 0

  const lkL = 2 * legM * Math.sin((input.thL / 2) * DEG_TO_RAD)
  const lkR = 2 * legM * Math.sin((input.thR / 2) * DEG_TO_RAD)
  const stepL = lkL + vBelt * tStepL
  const stepR = lkR + vBelt * tStepR
  const strideLength = stepL + stepR
  const symmetryIndex =
    stepL + stepR > 0 ? (Math.abs(stepL - stepR) / ((stepL + stepR) / 2)) * 100 : 0

  const tau: [number, number, number, number] = [0, 0, 0, 0]
  const ptf: [number, number, number, number] = [0, 0, 0, 0]
  for (let i = 0; i < 4; i += 1) {
    tau[i] = (input.fp[i] - input.fs[i]) * 0.25
    ptf[i] = input.fp[i] > 0 ? Math.max(0, (input.fp[i] - input.fs[i]) / input.fp[i]) : 0
  }
  const strScore = clamp01(ptf.reduce((sum, v) => sum + v, 0) / 4)

  const pL = input.pLTotal || 156.9
  const pR = input.pRTotal || 129.3
  const totalLoad = pL + pR
  const ali = totalLoad > 0 ? clamp01(1 - Math.abs(pL - pR) / totalLoad) : 0
  const pLPct = totalLoad > 0 ? (pL / totalLoad) * 100 : 50
  const pRPct = totalLoad > 0 ? (pR / totalLoad) * 100 : 50

  const dTheta = input.dTheta
  const kJoints: [number, number, number, number] = [0, 0, 0, 0]
  for (let i = 0; i < 4; i += 1) {
    const dt = Math.abs(dTheta[i]) || 0.01
    kJoints[i] = Math.abs(tau[i]) / dt
  }
  const jsiMean = (kJoints[0] + kJoints[1] + kJoints[2] + kJoints[3]) / 4

  const symmetryScore = clamp01(1 - symmetryIndex / Math.max(input.siBase, 0.1))
  const cvMean = (input.cvL + input.cvR) / 2
  const variabilityScore = clamp01(1 - cvMean / Math.max(input.cvBase, 0.1))
  const balanceScore =
    dsr <= 20 ? 1 : clamp01(1 - (dsr - 20) / Math.max(input.dsrBase - 20, 0.1))
  const speedScore = Math.min(1, vBelt / 0.9)
  const cadenceScore = Math.min(1, cadence / 110)
  const strideScore = Math.min(1, strideLength / 1.4)
  const efficiencyScore = (speedScore + cadenceScore + strideScore) / 3

  const gri =
    0.25 * symmetryScore +
    0.15 * variabilityScore +
    0.2 * balanceScore +
    0.2 * efficiencyScore +
    0.2 * strScore

  return {
    session: input.session,
    vBelt,
    tStanceL,
    tSwingL,
    tStanceR,
    tSwingR,
    tStride,
    tDouble,
    dsr,
    cadence,
    stepL,
    stepR,
    strideLength,
    symmetryIndex,
    cvL: input.cvL,
    cvR: input.cvR,
    cvMean,
    tau,
    ptf,
    kJoints,
    jsiMean,
    dTheta,
    pL,
    pR,
    totalLoad,
    pLPct,
    pRPct,
    ali,
    aspects: {
      S: symmetryScore,
      V: variabilityScore,
      B: balanceScore,
      E: efficiencyScore,
      STR: strScore,
    },
    gri,
    efficiency: { speed: speedScore, cadence: cadenceScore, strideLength: strideScore },
  }
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}
