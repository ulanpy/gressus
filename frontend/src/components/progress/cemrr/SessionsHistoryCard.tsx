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
import type { CemrrResult } from '../../../types/cemrr'
import { tooltipStyle } from '../../../constants/charts'

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
    <article className="cemrr-card cemrr-history">
      <header className="cemrr-card__head">
        <p className="eyebrow">{t.progress.cemrr.sessionsHeader}</p>
      </header>

      <div className="cemrr-history__charts">
        <div className="cemrr-history__chart">
          <div className="cemrr-history__chart-title">
            GRI · {t.progress.charts.symmetry} · {t.progress.charts.stability}
          </div>
          <div className="cemrr-history__chart-shell">
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

        <div className="cemrr-history__chart">
          <div className="cemrr-history__chart-title">
            {t.progress.charts.left} · {t.progress.charts.right}
          </div>
          <div className="cemrr-history__chart-shell">
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

      <div className="cemrr-history__pills" role="tablist">
        {results.map((r) => {
          const active = r.session === activeSession
          return (
            <button
              type="button"
              key={r.session}
              className={`cemrr-history__pill ${active ? 'cemrr-history__pill--active' : ''}`}
              onClick={() => onSelect(r.session)}
            >
              {t.progress.cemrr.sessionLabel} {r.session}
              <span>GRI {Math.round(r.gri * 100)}%</span>
            </button>
          )
        })}
      </div>
    </article>
  )
}
