import { useI18n } from '../../i18n/context'
import { formatShortDate } from '../../lib/format'
import type { ProgressSummaryCardsProps } from '../../types/components'
import { SummaryCard } from './SummaryCard'


export function ProgressSummaryCards({ summary }: ProgressSummaryCardsProps) {
  const { language, t } = useI18n()

  return (
    <div className="grid grid-cols-4 gap-4 max-[980px]:grid-cols-1">
      <SummaryCard
        label={t.progress.summary.gait}
        value={`${summary.latest.gaitScore}`}
        trend={t.progress.summary.fromBaseline(Math.round(summary.gaitScorePercent))}
      />
      <SummaryCard
        label={t.progress.summary.symmetry}
        value={`+${summary.symmetryChange}`}
        trend={t.progress.summary.sinceSessionOne(Math.round(summary.symmetryPercent))}
      />
      <SummaryCard
        label={t.progress.summary.stability}
        value={`+${summary.stabilityChange}`}
        trend={t.progress.summary.sinceSessionOne(Math.round(summary.stabilityPercent))}
      />
      <SummaryCard
        label={t.progress.summary.sessions}
        value={`${summary.sessionsCompleted}`}
        trend={t.progress.summary.dateRange(
          formatShortDate(summary.baseline.date, language),
          formatShortDate(summary.latest.date, language),
        )}
      />
    </div>
  )
}
