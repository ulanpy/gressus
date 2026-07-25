import { useI18n } from '../../i18n/context'
import { recommendationText } from '../../lib/i18nText'
import { cn } from '@/shared/lib/utils'
import { progressCard } from '../../styles/ui'
import type { TherapyRecommendationsCardProps } from '../../types/components'
import { CardHeading } from '@/shared/layout/CardHeading'

const recommendationRow =
  'grid grid-cols-[86px_minmax(0,1fr)] gap-3.5 items-start p-4 max-[640px]:grid-cols-1 border border-slate-200/72 rounded-[20px] bg-white/58'

const recommendationBadgeTone = {
  focus: 'text-blue-800 bg-blue-100',
  steady: 'text-teal-700 bg-teal-100',
  positive: 'text-emerald-700 bg-emerald-100',
} as const


export function TherapyRecommendationsCard({ recommendations }: TherapyRecommendationsCardProps) {
  const { language, t } = useI18n()

  return (
    <article className={progressCard}>
      <CardHeading eyebrow={t.progress.recommendations.eyebrow} title={t.progress.recommendations.title} />
      <div className="grid gap-3">
        {recommendations.map((recommendation) => (
          <div className={recommendationRow} key={recommendation.id}>
            <span
              className={cn(
                'rounded-full px-2.5 py-1.5 text-center text-xs font-bold',
                recommendationBadgeTone[recommendation.tone],
              )}
            >
              {t.progress.recommendations.badges[recommendation.tone]}
            </span>
            <div>
              <strong className="block text-text-strong text-base">
                {recommendationText(recommendation, language).label}
              </strong>
              <p className="mt-[5px] mb-0 text-muted text-sm leading-[1.55]">
                {recommendationText(recommendation, language).detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}
