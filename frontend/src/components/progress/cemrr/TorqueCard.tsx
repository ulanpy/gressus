import { useI18n } from '../../../i18n/context'
import type { CemrrResult } from '../../../types/cemrr'
import { fmtCemrr } from './AspectScoresCard'

type Props = {
  result: CemrrResult
}

export function TorqueCard({ result }: Props) {
  const { t } = useI18n()
  const joints = t.progress.cemrr.joints

  return (
    <article className="cemrr-card">
      <header className="cemrr-card__head">
        <p className="eyebrow">{t.progress.cemrr.torqueTitle}</p>
      </header>

      <div className="cemrr-torque-grid">
        {result.tau.map((tau, index) => {
          const ptf = result.ptf[index]
          const positive = tau > 0.02
          const negative = tau < -0.01
          const statusKey = negative ? 'spasticity' : positive ? 'assist' : 'passive'
          const statusColor = negative
            ? 'rgb(248 113 113)'
            : positive
              ? 'rgb(16 185 129)'
              : 'rgb(148 163 184)'

          return (
            <div className="cemrr-torque" key={index}>
              <span className="cemrr-torque__joint">{joints[index]}</span>
              <div className="cemrr-torque__row">
                <strong className={positive ? 'pos' : negative ? 'neg' : ''}>
                  {tau >= 0 ? '+' : ''}
                  {fmtCemrr(tau, 3)} Nm
                </strong>
                <span style={{ color: statusColor }}>{t.progress.cemrr[statusKey]}</span>
              </div>
              <div className="cemrr-torque__track">
                <div
                  className="cemrr-torque__fill"
                  style={{ width: `${Math.min(100, ptf * 100).toFixed(1)}%` }}
                />
              </div>
              <span className="cemrr-torque__caption">PTF = {fmtCemrr(ptf * 100, 1)}%</span>
            </div>
          )
        })}
      </div>
    </article>
  )
}
