import { useMemo } from 'react'
import { calculateProgressSummary, generateTherapyRecommendations } from '../../progressAnalytics'
import { useI18n } from '../../i18n/context'
import type { ProgressDashboardProps } from '../../types/components'
import { ProgressSummaryCards } from './ProgressSummaryCards'
import { SessionTrendChart } from './SessionTrendChart'
import { LoadBalanceChart } from './LoadBalanceChart'
import { ClinicalDomainsCard } from './ClinicalDomainsCard'
import { TherapyRecommendationsCard } from './TherapyRecommendationsCard'
import { BaselineLatestCard } from './BaselineLatestCard'


export function ProgressDashboard({ metrics }: ProgressDashboardProps) {
  const { t } = useI18n()
  const summary = useMemo(() => calculateProgressSummary(metrics), [metrics])
  const recommendations = useMemo(() => generateTherapyRecommendations(metrics), [metrics])

  return (
    <section className="progress-dashboard" aria-label={t.progress.aria}>
      <ProgressSummaryCards summary={summary} />

      <div className="progress-grid progress-grid--charts">
        <SessionTrendChart metrics={metrics} />
        <LoadBalanceChart metrics={metrics} />
      </div>

      <div className="progress-grid progress-grid--supporting">
        <ClinicalDomainsCard metrics={metrics} />
        <TherapyRecommendationsCard recommendations={recommendations} />
      </div>

      <BaselineLatestCard summary={summary} />
    </section>
  )
}
