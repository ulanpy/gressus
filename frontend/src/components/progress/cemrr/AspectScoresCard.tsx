import { useI18n } from '../../../i18n/context'
import type { CemrrResult } from '../../../types/cemrr'
import { ASPECT_COLORS, ASPECT_KEYS, scoreColor } from './GriHero'

type AspectScoresCardProps = {
  result: CemrrResult
}

export function AspectScoresCard({ result }: AspectScoresCardProps) {
  const { t } = useI18n()

  const detail = {
    S: `SI=${fmt(result.symmetryIndex, 1)}%  L:${fmt(result.stepL, 3)}m  R:${fmt(result.stepR, 3)}m`,
    V: `CV_L=${fmt(result.cvL, 2)}%  CV_R=${fmt(result.cvR, 2)}%  mean=${fmt(result.cvMean, 2)}%`,
    B: `DSR=${fmt(result.dsr, 1)}%  DS=${fmt(result.tDouble, 3)}s`,
    E: `speed=${fmt(result.efficiency.speed, 2)}  cad=${fmt(result.efficiency.cadence, 2)}  SL=${fmt(result.efficiency.strideLength, 2)}`,
    STR: `PTF: Lhip=${fmt(result.ptf[0] * 100, 1)}%  Rhip=${fmt(result.ptf[1] * 100, 1)}%  Lkne=${fmt(result.ptf[2] * 100, 1)}%  Rkne=${fmt(result.ptf[3] * 100, 1)}%`,
  } as const

  return (
    <article className="cemrr-card">
      <header className="cemrr-card__head">
        <p className="eyebrow">{t.progress.cemrr.aspectsTitle}</p>
      </header>
      <div className="cemrr-aspects">
        {ASPECT_KEYS.map((key) => {
          const value = result.aspects[key]
          const pct = Math.round(value * 100)
          const color = ASPECT_COLORS[key]
          return (
            <div className="cemrr-aspect" style={{ borderLeftColor: color }} key={key}>
              <div className="cemrr-aspect__head">
                <span>{t.progress.cemrr.aspects[key]}</span>
                <span className={`cemrr-pill cemrr-pill--${pillTone(value)}`}>
                  {pillLabel(value, t.progress.cemrr.good, t.progress.cemrr.improving, t.progress.cemrr.needsWork)}
                </span>
              </div>
              <strong style={{ color }}>{pct}%</strong>
              <div className="cemrr-aspect__track">
                <div
                  className="cemrr-aspect__fill"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <span className="cemrr-aspect__detail">{detail[key]}</span>
            </div>
          )
        })}
      </div>
    </article>
  )
}

function fmt(value: number, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
}

function pillTone(value: number) {
  if (value >= 0.65) return 'good'
  if (value >= 0.35) return 'mid'
  return 'bad'
}

function pillLabel(value: number, good: string, improving: string, needs: string) {
  if (value >= 0.65) return good
  if (value >= 0.35) return improving
  return needs
}

export { fmt as fmtCemrr, scoreColor }
