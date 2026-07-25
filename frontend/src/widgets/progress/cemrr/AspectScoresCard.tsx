import { useI18n } from '../../../i18n/context'
import { cn } from '@/shared/lib/utils'
import type { CemrrResult } from '../../../types/cemrr'
import {
  cemrrAspect,
  cemrrAspectDetail,
  cemrrAspectFill,
  cemrrAspectHead,
  cemrrAspectPill,
  cemrrAspectPillBad,
  cemrrAspectPillGood,
  cemrrAspectPillMid,
  cemrrAspects,
  cemrrAspectTrack,
  cemrrAspectValue,
  cemrrCard,
  cemrrCardHead,
  eyebrow,
} from '../../../styles/ui'
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
    <article className={cemrrCard}>
      <header className={cemrrCardHead}>
        <p className={eyebrow}>{t.progress.cemrr.aspectsTitle}</p>
      </header>
      <div className={cemrrAspects}>
        {ASPECT_KEYS.map((key) => {
          const value = result.aspects[key]
          const pct = Math.round(value * 100)
          const color = ASPECT_COLORS[key]
          return (
            <div className={cemrrAspect} style={{ borderLeftColor: color }} key={key}>
              <div className={cemrrAspectHead}>
                <span>{t.progress.cemrr.aspects[key]}</span>
                <span
                  className={cn(
                    cemrrAspectPill,
                    pillTone(value) === 'good'
                      ? cemrrAspectPillGood
                      : pillTone(value) === 'mid'
                        ? cemrrAspectPillMid
                        : cemrrAspectPillBad,
                  )}
                >
                  {pillLabel(value, t.progress.cemrr.good, t.progress.cemrr.improving, t.progress.cemrr.needsWork)}
                </span>
              </div>
              <strong className={cemrrAspectValue} style={{ color }}>
                {pct}%
              </strong>
              <div className={cemrrAspectTrack}>
                <div
                  className={cemrrAspectFill}
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <span className={cemrrAspectDetail}>{detail[key]}</span>
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
