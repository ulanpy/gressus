import { useI18n } from '../../../i18n/context'
import type { CemrrRecommendation } from '../../../types/cemrr'
import { fillTemplate } from '../../../lib/cemrr/recommendations'

type Props = {
  recommendations: CemrrRecommendation[]
}

const TONE_CLASS: Record<CemrrRecommendation['tone'], string> = {
  high: 'cemrr-rec--high',
  mid: 'cemrr-rec--mid',
  low: 'cemrr-rec--low',
}

const TONE_ICON: Record<CemrrRecommendation['tone'], string> = {
  high: '!',
  mid: '~',
  low: 'ok',
}

export function CemrrRecommendationsCard({ recommendations }: Props) {
  const { t } = useI18n()

  return (
    <article className="cemrr-card">
      <header className="cemrr-card__head">
        <p className="eyebrow">{t.progress.cemrr.recommendationsTitle}</p>
      </header>

      <div className="cemrr-rec-list">
        {recommendations.map((rec) => {
          const tuple = t.progress.cemrr.rec[rec.id]
          const label = tuple?.[0] ?? rec.id
          const text = fillTemplate(tuple?.[1] ?? '', rec.vars)
          return (
            <div className={`cemrr-rec ${TONE_CLASS[rec.tone]}`} key={rec.id}>
              <span className="cemrr-rec__badge">{TONE_ICON[rec.tone]}</span>
              <div className="cemrr-rec__body">
                <strong>{label}</strong>
                <p>{text}</p>
              </div>
            </div>
          )
        })}
      </div>
    </article>
  )
}
