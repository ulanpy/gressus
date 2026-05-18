import type { Language } from '../../types/i18n'
import { formatShortDate, formatMetricValue } from '../../lib/format'


export function ComparisonColumn({
  date,
  language,
  metrics,
  mode,
  title,
}: {
  date: string
  language: Language
  metrics: { label: string; baseline: number; latest: number; unit?: string }[]
  mode: 'baseline' | 'latest'
  title: string
}) {
  return (
    <div className="comparison-column">
      <div>
        <span>{title}</span>
        <strong>{formatShortDate(date, language)}</strong>
      </div>
      {metrics.map((metric) => {
        const value = mode === 'baseline' ? metric.baseline : metric.latest

        return (
          <p key={metric.label}>
            <span>{metric.label}</span>
            <b>
              {formatMetricValue(value)}
              {metric.unit ? ` ${metric.unit}` : ''}
            </b>
          </p>
        )
      })}
    </div>
  )
}
