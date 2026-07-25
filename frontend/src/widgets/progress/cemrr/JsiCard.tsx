import { useI18n } from '../../../i18n/context'
import type { CemrrResult } from '../../../types/cemrr'
import {
  cemrrCard,
  cemrrCardFormula,
  cemrrCardHead,
  cemrrJsi,
  cemrrJsiCaption,
  cemrrJsiFill,
  cemrrJsiHead,
  cemrrJsiRef,
  cemrrJsiRow,
  cemrrJsiSummary,
  cemrrJsiTrack,
  eyebrow,
} from '../../../styles/ui'
import { fmtCemrr } from './AspectScoresCard'

type Props = {
  result: CemrrResult
}

const JSI_REF = 0.1

export function JsiCard({ result }: Props) {
  const { t } = useI18n()
  const joints = t.progress.cemrr.joints

  return (
    <article className={cemrrCard}>
      <header className={cemrrCardHead}>
        <p className={eyebrow}>{t.progress.cemrr.jsiTitle}</p>
        <code className={cemrrCardFormula}>{t.progress.cemrr.jsiFormula}</code>
      </header>

      <div className={cemrrJsi}>
        {result.kJoints.map((kValue, index) => {
          const color = kValue > 0.08 ? 'rgb(248 113 113)' : kValue > 0.05 ? 'rgb(245 158 11)' : 'rgb(16 185 129)'
          const pct = Math.min(100, (kValue / JSI_REF) * 100)
          return (
            <div className={cemrrJsiRow} key={index}>
              <div className={cemrrJsiHead}>
                <span>{joints[index]}</span>
                <strong style={{ color }}>{fmtCemrr(kValue, 4)} Nm/°</strong>
              </div>
              <div className={cemrrJsiTrack}>
                <div
                  className={cemrrJsiFill}
                  style={{ width: `${pct.toFixed(1)}%`, background: color }}
                />
              </div>
              <span className={cemrrJsiCaption}>
                Δτ={fmtCemrr(Math.abs(result.tau[index]), 3)} Nm · Δθ=
                {fmtCemrr(Math.abs(result.dTheta[index]), 1)}°
              </span>
            </div>
          )
        })}

        <div className={cemrrJsiSummary}>
          <span>
            mean JSI = <strong>{fmtCemrr(result.jsiMean, 4)} Nm/°</strong>
          </span>
          <span className={cemrrJsiRef}>{t.progress.cemrr.jsiRef}</span>
        </div>
      </div>
    </article>
  )
}
