import type { Language } from '../../types/i18n'
import { formatShortDate, formatMetricValue } from '../../lib/format'

const comparisonColumn =
  'grid gap-3 p-[18px] border border-slate-200/72 rounded-[20px] bg-white/58'


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
    <div className={comparisonColumn}>
      <div>
        <span className="text-muted text-[13px]">{title}</span>
        <strong className="block mt-1 text-text-strong text-xl">{formatShortDate(date, language)}</strong>
      </div>
      {metrics.map((metric) => {
        const value = mode === 'baseline' ? metric.baseline : metric.latest

        return (
          <p className="flex justify-between gap-3.5 m-0 text-text" key={metric.label}>
            <span className="text-muted text-[13px]">{metric.label}</span>
            <b className="text-text-strong font-extrabold">
              {formatMetricValue(value)}
              {metric.unit ? ` ${metric.unit}` : ''}
            </b>
          </p>
        )
      })}
    </div>
  )
}
