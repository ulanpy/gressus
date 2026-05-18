import { useI18n } from '../../../i18n/context'
import type { CemrrResult } from '../../../types/cemrr'
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
    <article className="cemrr-card">
      <header className="cemrr-card__head">
        <p className="eyebrow">{t.progress.cemrr.aliTitle}</p>
        <code className="cemrr-card__formula">{t.progress.cemrr.aliFormula}</code>
      </header>

      <div className="cemrr-ali">
        <strong className="cemrr-ali__value" style={{ color }}>
          {fmtCemrr(result.ali, 3)}
        </strong>
        <span className="cemrr-ali__caption">{t.progress.cemrr.aliCaption}</span>

        <div className="cemrr-ali__bar-label">{t.progress.cemrr.loadDist}</div>
        <div className="cemrr-ali__bar">
          <div className="cemrr-ali__bar-left" style={{ width: `${leftPct}%` }}>
            {leftPct}%
          </div>
          <div className="cemrr-ali__bar-right">{rightPct}%</div>
        </div>

        <div className="cemrr-ali__legend">
          <span>
            <i className="cemrr-dot cemrr-dot--blue" /> {t.progress.cemrr.leftFoot}:{' '}
            {fmtCemrr(result.pL, 1)} %BW
          </span>
          <span>
            <i className="cemrr-dot cemrr-dot--amber" /> {t.progress.cemrr.rightFoot}:{' '}
            {fmtCemrr(result.pR, 1)} %BW
          </span>
        </div>
      </div>
    </article>
  )
}
