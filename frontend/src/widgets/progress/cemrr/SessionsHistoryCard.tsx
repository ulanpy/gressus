import { useI18n } from '../../../i18n/context'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/shared/lib/utils'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import type { CemrrResult } from '../../../types/cemrr'
import { tooltipStyle } from '../../../constants/charts'
import {
  cemrrCard,
  cemrrCardHead,
  cemrrHistory,
  cemrrHistoryChart,
  cemrrHistoryCharts,
  cemrrHistoryChartShell,
  cemrrHistoryChartTitle,
  eyebrow,
} from '../../../styles/ui'

type Props = {
  results: CemrrResult[]
  activeSession: number
  onSelect: (session: number) => void
}

export function SessionsHistoryCard({ results, activeSession, onSelect }: Props) {
  const { t } = useI18n()

  if (results.length === 0) return null

  const trend = results.map((r) => ({
    session: r.session,
    gri: Math.round(r.gri * 100),
    symmetry: Math.round(r.aspects.S * 100),
    stability: Math.round(r.aspects.B * 100),
    ali: Number((r.ali * 100).toFixed(1)),
  }))

  const load = results.map((r) => ({
    session: r.session,
    left: Number(r.pL.toFixed(1)),
    right: Number(r.pR.toFixed(1)),
  }))

  return (
    <article className={cn(cemrrCard, cemrrHistory)}>
      <header className={cemrrCardHead}>
        <p className={eyebrow}>{t.progress.cemrr.sessionsHeader}</p>
      </header>

      <div className={cemrrHistoryCharts}>
        <div className={cemrrHistoryChart}>
          <div className={cemrrHistoryChartTitle}>
            GRI · {t.progress.charts.symmetry} · {t.progress.charts.stability}
          </div>
          <div className={cemrrHistoryChartShell}>
            <ResponsiveContainer width="100%" height="100%" key={`trend-${results.length}`}>
              <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="rgb(226 232 240)" vertical={false} />
                <XAxis
                  dataKey="session"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ color: '#64748b', fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="gri"
                  name="GRI"
                  stroke="#0891b2"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#0891b2' }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="symmetry"
                  name={t.progress.charts.symmetry}
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#2563eb' }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="stability"
                  name={t.progress.charts.stability}
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#10b981' }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cemrrHistoryChart}>
          <div className={cemrrHistoryChartTitle}>
            {t.progress.charts.left} · {t.progress.charts.right}
          </div>
          <div className={cemrrHistoryChartShell}>
            <ResponsiveContainer width="100%" height="100%" key={`load-${results.length}`}>
              <BarChart data={load} margin={{ top: 8, right: 16, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="rgb(226 232 240)" vertical={false} />
                <XAxis
                  dataKey="session"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ color: '#64748b', fontSize: 12 }} />
                <Bar
                  dataKey="left"
                  name={t.progress.charts.left}
                  fill="#38bdf8"
                  radius={[8, 8, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="right"
                  name={t.progress.charts.right}
                  fill="#34d399"
                  radius={[8, 8, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <ToggleGroup
        type="single"
        value={String(activeSession)}
        onValueChange={(next) => {
          if (next) onSelect(Number(next))
        }}
        className="flex flex-wrap gap-1.5"
        role="tablist"
      >
        {results.map((r) => (
          <ToggleGroupItem
            key={r.session}
            value={String(r.session)}
            className={cn(
              'inline-flex h-auto flex-col items-start gap-0.5 rounded-[14px] border border-panel-border bg-white px-3.5 py-2 text-left text-xs font-semibold text-text-strong shadow-none',
              'data-[state=on]:border-cyan-400 data-[state=on]:bg-cyan-50 data-[state=on]:text-cyan-700',
              '[&_span]:text-[10px] [&_span]:text-muted [&_span]:tabular-nums data-[state=on]:[&_span]:text-cyan-600',
            )}
          >
            {t.progress.cemrr.sessionLabel} {r.session}
            <span>GRI {Math.round(r.gri * 100)}%</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </article>
  )
}
