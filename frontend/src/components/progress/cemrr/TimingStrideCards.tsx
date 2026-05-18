import { useI18n } from '../../../i18n/context'
import type { CemrrResult } from '../../../types/cemrr'
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
    <div className="cemrr-grid cemrr-grid--two">
      <article className="cemrr-card">
        <header className="cemrr-card__head">
          <p className="eyebrow">{t.progress.cemrr.timingTitle}</p>
        </header>
        <div className="cemrr-metrics cemrr-metrics--two">
          {timing.map(([label, value]) => (
            <Metric key={label} label={label} value={value} />
          ))}
        </div>
      </article>

      <article className="cemrr-card">
        <header className="cemrr-card__head">
          <p className="eyebrow">{t.progress.cemrr.strideTitle}</p>
        </header>
        <div className="cemrr-metrics cemrr-metrics--two">
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
    <div className="cemrr-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
