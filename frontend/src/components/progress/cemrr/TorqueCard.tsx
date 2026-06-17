import { useI18n } from '../../../i18n/context'
import { cn } from '../../../lib/cn'
import type { CemrrResult } from '../../../types/cemrr'
import {
  cemrrCard,
  cemrrCardHead,
  cemrrTorque,
  cemrrTorqueCaption,
  cemrrTorqueFill,
  cemrrTorqueGrid,
  cemrrTorqueJoint,
  cemrrTorqueNeg,
  cemrrTorquePos,
  cemrrTorqueRow,
  cemrrTorqueTrack,
  eyebrow,
} from '../../../styles/ui'
import { fmtCemrr } from './AspectScoresCard'

type Props = {
  result: CemrrResult
}

export function TorqueCard({ result }: Props) {
  const { t } = useI18n()
  const joints = t.progress.cemrr.joints

  return (
    <article className={cemrrCard}>
      <header className={cemrrCardHead}>
        <p className={eyebrow}>{t.progress.cemrr.torqueTitle}</p>
      </header>

      <div className={cemrrTorqueGrid}>
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
            <div className={cemrrTorque} key={index}>
              <span className={cemrrTorqueJoint}>{joints[index]}</span>
              <div className={cemrrTorqueRow}>
                <strong className={cn(positive && cemrrTorquePos, negative && cemrrTorqueNeg)}>
                  {tau >= 0 ? '+' : ''}
                  {fmtCemrr(tau, 3)} Nm
                </strong>
                <span style={{ color: statusColor }}>{t.progress.cemrr[statusKey]}</span>
              </div>
              <div className={cemrrTorqueTrack}>
                <div
                  className={cemrrTorqueFill}
                  style={{ width: `${Math.min(100, ptf * 100).toFixed(1)}%` }}
                />
              </div>
              <span className={cemrrTorqueCaption}>PTF = {fmtCemrr(ptf * 100, 1)}%</span>
            </div>
          )
        })}
      </div>
    </article>
  )
}
