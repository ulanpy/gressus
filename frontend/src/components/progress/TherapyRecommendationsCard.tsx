import { useI18n } from '../../i18n/context'
import { recommendationText } from '../../lib/i18nText'
import type { TherapyRecommendationsCardProps } from '../../types/components'
import { CardHeading } from '../layout/CardHeading'


export function TherapyRecommendationsCard({ recommendations }: TherapyRecommendationsCardProps) {
  const { language, t } = useI18n()

  return (
    <article className="progress-card">
      <CardHeading eyebrow={t.progress.recommendations.eyebrow} title={t.progress.recommendations.title} />
      <div className="recommendation-list">
        {recommendations.map((recommendation) => (
          <div className="recommendation-row" key={recommendation.id}>
            <span className={`recommendation-badge recommendation-badge--${recommendation.tone}`}>
              {t.progress.recommendations.badges[recommendation.tone]}
            </span>
            <div>
              <strong>{recommendationText(recommendation, language).label}</strong>
              <p>{recommendationText(recommendation, language).detail}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}
