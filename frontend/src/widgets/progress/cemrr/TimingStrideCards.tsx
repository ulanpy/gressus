import { useI18n } from '../../../i18n/context'
import type { CemrrResult } from '../../../types/cemrr'
import {
  cemrrCard,
  cemrrCardHead,
  cemrrGridTwo,
  cemrrMetric,
  cemrrMetricsTwo,
  eyebrow,
} from '../../../styles/ui'
import { fmtCemrr } from './AspectScoresCard'

type Props = {
  result: CemrrResult
}

export function TimingStrideCards({ result }: Props) {
  const { t } = useI18n()

  const timing: [string, string][] = [
    [t.progress.cemrr.tStanceL, `${fmtCemrr(result.tStanceL, 3)} s`],
    [t.progress.cemrr.tSwingL, `${fmtCemrr(result.tSwingL, 3)} s`],
    [t.progress.cemrr.tStanceR, `${fmtCemrr(result.tStanceR, 3)} s`],
    [t.progress.cemrr.tSwingR, `${fmtCemrr(result.tSwingR, 3)} s`],
    [t.progress.cemrr.tStride, `${fmtCemrr(result.tStride, 3)} s`],
    [t.progress.cemrr.tDouble, `${fmtCemrr(result.tDouble, 3)} s`],
    [t.progress.cemrr.tCadence, `${Math.round(result.cadence)} spm`],
    [t.progress.cemrr.tDsr, `${fmtCemrr(result.dsr, 1)}%`],
  ]

  const stride: [string, string][] = [
    [t.progress.cemrr.slStepL, `${fmtCemrr(result.stepL, 3)} m`],
    [t.progress.cemrr.slStepR, `${fmtCemrr(result.stepR, 3)} m`],
    [t.progress.cemrr.slStride, `${fmtCemrr(result.strideLength, 3)} m`],
    [t.progress.cemrr.slSI, `${fmtCemrr(result.symmetryIndex, 1)}%`],
  ]

  return (
    <div className={cemrrGridTwo}>
      <article className={cemrrCard}>
        <header className={cemrrCardHead}>
          <p className={eyebrow}>{t.progress.cemrr.timingTitle}</p>
        </header>
        <div className={cemrrMetricsTwo}>
          {timing.map(([label, value]) => (
            <Metric key={label} label={label} value={value} />
          ))}
        </div>
      </article>

      <article className={cemrrCard}>
        <header className={cemrrCardHead}>
          <p className={eyebrow}>{t.progress.cemrr.strideTitle}</p>
        </header>
        <div className={cemrrMetricsTwo}>
          {stride.map(([label, value]) => (
            <Metric key={label} label={label} value={value} />
          ))}
        </div>
      </article>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={cemrrMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
