import { useI18n } from '../../i18n/context'
import type { ProgressSummary } from '../../progressAnalytics'
import { cn } from '../../lib/cn'
import { progressCard } from '../../styles/ui'
import { CardHeading } from '../layout/CardHeading'
import { ComparisonColumn } from './ComparisonColumn'


export function BaselineLatestCard({ summary }: { summary: ProgressSummary }) {
  const { language, t } = useI18n()
  const metrics = [
    { label: t.progress.baseline.gaitScore, baseline: summary.baseline.gaitScore, latest: summary.latest.gaitScore },
    { label: t.progress.baseline.walkingSpeed, baseline: summary.baseline.walkingSpeed, latest: summary.latest.walkingSpeed, unit: 'm/s' },
    { label: t.progress.baseline.cadence, baseline: summary.baseline.cadence, latest: summary.latest.cadence, unit: 'spm' },
    { label: t.progress.baseline.loadGap, baseline: Math.abs(summary.baseline.leftAvgPressure - summary.baseline.rightAvgPressure), latest: Math.abs(summary.latest.leftAvgPressure - summary.latest.rightAvgPressure), unit: t.live.kpa },
  ]

  return (
    <article className={cn(progressCard, 'mt-6')}>
      <CardHeading eyebrow={t.progress.baseline.eyebrow} title={t.progress.baseline.title} />
      <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        <ComparisonColumn title={`${t.progress.baseline.session} ${summary.baseline.session}`} date={summary.baseline.date} language={language} metrics={metrics} mode="baseline" />
        <ComparisonColumn title={`${t.progress.baseline.session} ${summary.latest.session}`} date={summary.latest.date} language={language} metrics={metrics} mode="latest" />
      </div>
    </article>
  )
}
