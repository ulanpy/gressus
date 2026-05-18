import { useI18n } from '../../../i18n/context'
import type { CemrrResult } from '../../../types/cemrr'
import { fmtCemrr } from './AspectScoresCard'

type Props = {
  result: CemrrResult
}

const JSI_REF = 0.1

export function JsiCard({ result }: Props) {
  const { t } = useI18n()
  const joints = t.progress.cemrr.joints

  return (
    <article className="cemrr-card">
      <header className="cemrr-card__head">
        <p className="eyebrow">{t.progress.cemrr.jsiTitle}</p>
        <code className="cemrr-card__formula">{t.progress.cemrr.jsiFormula}</code>
      </header>

      <div className="cemrr-jsi">
        {result.kJoints.map((kValue, index) => {
          const color = kValue > 0.08 ? 'rgb(248 113 113)' : kValue > 0.05 ? 'rgb(245 158 11)' : 'rgb(16 185 129)'
          const pct = Math.min(100, (kValue / JSI_REF) * 100)
          return (
            <div className="cemrr-jsi__row" key={index}>
              <div className="cemrr-jsi__head">
                <span>{joints[index]}</span>
                <strong style={{ color }}>{fmtCemrr(kValue, 4)} Nm/°</strong>
              </div>
              <div className="cemrr-jsi__track">
                <div
                  className="cemrr-jsi__fill"
                  style={{ width: `${pct.toFixed(1)}%`, background: color }}
                />
              </div>
              <span className="cemrr-jsi__caption">
                Δτ={fmtCemrr(Math.abs(result.tau[index]), 3)} Nm · Δθ=
                {fmtCemrr(Math.abs(result.dTheta[index]), 1)}°
              </span>
            </div>
          )
        })}

        <div className="cemrr-jsi__summary">
          <span>
            mean JSI = <strong>{fmtCemrr(result.jsiMean, 4)} Nm/°</strong>
          </span>
          <span className="cemrr-jsi__ref">{t.progress.cemrr.jsiRef}</span>
        </div>
      </div>
    </article>
  )
}
