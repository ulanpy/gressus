import { useI18n } from '../../../i18n/context'
import { cn } from '@/shared/lib/utils'
import type { CemrrResult } from '../../../types/cemrr'
import {
  cemrrAli,
  cemrrAliBar,
  cemrrAliBarLabel,
  cemrrAliBarLeft,
  cemrrAliBarRight,
  cemrrAliCaption,
  cemrrAliLegend,
  cemrrAliValue,
  cemrrCard,
  cemrrCardFormula,
  cemrrCardHead,
  cemrrDot,
  cemrrDotAmber,
  cemrrDotBlue,
  eyebrow,
} from '../../../styles/ui'
import { fmtCemrr } from './AspectScoresCard'
import { scoreColor } from './GriHero'

type Props = {
  result: CemrrResult
}

export function AliCard({ result }: Props) {
  const { t } = useI18n()
  const color = scoreColor(result.ali)
  const leftPct = Math.round(result.pLPct)
  const rightPct = Math.round(result.pRPct)

  return (
    <article className={cemrrCard}>
      <header className={cemrrCardHead}>
        <p className={eyebrow}>{t.progress.cemrr.aliTitle}</p>
        <code className={cemrrCardFormula}>{t.progress.cemrr.aliFormula}</code>
      </header>

      <div className={cemrrAli}>
        <strong className={cemrrAliValue} style={{ color }}>
          {fmtCemrr(result.ali, 3)}
        </strong>
        <span className={cemrrAliCaption}>{t.progress.cemrr.aliCaption}</span>

        <div className={cemrrAliBarLabel}>{t.progress.cemrr.loadDist}</div>
        <div className={cemrrAliBar}>
          <div className={cemrrAliBarLeft} style={{ width: `${leftPct}%` }}>
            {leftPct}%
          </div>
          <div className={cemrrAliBarRight}>{rightPct}%</div>
        </div>

        <div className={cemrrAliLegend}>
          <span>
            <i className={cn(cemrrDot, cemrrDotBlue)} /> {t.progress.cemrr.leftFoot}:{' '}
            {fmtCemrr(result.pL, 1)} %BW
          </span>
          <span>
            <i className={cn(cemrrDot, cemrrDotAmber)} /> {t.progress.cemrr.rightFoot}:{' '}
            {fmtCemrr(result.pR, 1)} %BW
          </span>
        </div>
      </div>
    </article>
  )
}
