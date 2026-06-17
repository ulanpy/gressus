import { useI18n } from '../../../i18n/context'
import { cn } from '../../../lib/cn'
import type { CemrrRecommendation } from '../../../types/cemrr'
import { fillTemplate } from '../../../lib/cemrr/recommendations'
import {
  cemrrCard,
  cemrrCardHead,
  cemrrRec,
  cemrrRecBadge,
  cemrrRecBodyStrong,
  cemrrRecBodyText,
  cemrrRecHigh,
  cemrrRecList,
  cemrrRecLow,
  cemrrRecMid,
  eyebrow,
} from '../../../styles/ui'

type Props = {
  recommendations: CemrrRecommendation[]
}

const TONE_CLASS: Record<CemrrRecommendation['tone'], string> = {
  high: cemrrRecHigh,
  mid: cemrrRecMid,
  low: cemrrRecLow,
}

const TONE_ICON: Record<CemrrRecommendation['tone'], string> = {
  high: '!',
  mid: '~',
  low: 'ok',
}

export function CemrrRecommendationsCard({ recommendations }: Props) {
  const { t } = useI18n()

  return (
    <article className={cemrrCard}>
      <header className={cemrrCardHead}>
        <p className={eyebrow}>{t.progress.cemrr.recommendationsTitle}</p>
      </header>

      <div className={cemrrRecList}>
        {recommendations.map((rec) => {
          const tuple = t.progress.cemrr.rec[rec.id]
          const label = tuple?.[0] ?? rec.id
          const text = fillTemplate(tuple?.[1] ?? '', rec.vars)
          return (
            <div className={cn(cemrrRec, TONE_CLASS[rec.tone])} key={rec.id}>
              <span className={cemrrRecBadge}>{TONE_ICON[rec.tone]}</span>
              <div>
                <strong className={cemrrRecBodyStrong}>{label}</strong>
                <p className={cemrrRecBodyText}>{text}</p>
              </div>
            </div>
          )
        })}
      </div>
    </article>
  )
}
