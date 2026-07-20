import { memo, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { tooltipStyle } from '../../constants/charts'
import { useI18n } from '../../i18n/context'
import {
  JOINT_IDS,
  TELEMETRY_WINDOW_SECONDS,
  type JointId,
  type TelemetryHistoryPoint,
  type TelemetryMetric,
  toChartRows,
} from '../../lib/exoskeleton/telemetryHistory'
import { cn } from '../../lib/cn'

type LiveJointTelemetryChartProps = {
  history: TelemetryHistoryPoint[]
  windowSeconds?: number
}

const JOINT_COLOR: Record<JointId, string> = {
  HR: '#2563eb',
  KR: '#0ea5e9',
  HL: '#7c3aed',
  KL: '#8b5cf6',
}

const METRICS: TelemetryMetric[] = ['pos', 'refPos', 'vel', 'measTorque']

/** Fixed X ticks for the rolling window (oldest → now). */
function xTicks(windowSeconds: number): number[] {
  const step = windowSeconds <= 30 ? 5 : 10
  const ticks: number[] = []
  for (let t = 0; t <= windowSeconds; t += step) ticks.push(t)
  if (ticks[ticks.length - 1] !== windowSeconds) ticks.push(windowSeconds)
  return ticks
}

function metricLabel(metric: TelemetryMetric, t: ReturnType<typeof useI18n>['t']): string {
  switch (metric) {
    case 'pos':
      return t.exoskeleton.metricPos
    case 'refPos':
      return t.exoskeleton.metricRefPos
    case 'vel':
      return t.exoskeleton.metricVel
    case 'measTorque':
      return t.exoskeleton.metricTorque
  }
}

function jointLabel(id: JointId, t: ReturnType<typeof useI18n>['t']): string {
  switch (id) {
    case 'HR':
      return t.workflow.jointHR
    case 'KR':
      return t.workflow.jointKR
    case 'HL':
      return t.workflow.jointHL
    case 'KL':
      return t.workflow.jointKL
  }
}

export const LiveJointTelemetryChart = memo(function LiveJointTelemetryChart({
  history,
  windowSeconds = TELEMETRY_WINDOW_SECONDS,
}: LiveJointTelemetryChartProps) {
  const { t } = useI18n()
  const [metric, setMetric] = useState<TelemetryMetric>('pos')
  const chartData = useMemo(
    () => toChartRows(history, metric, Date.now(), windowSeconds),
    [history, metric, windowSeconds],
  )
  const ticks = useMemo(() => xTicks(windowSeconds), [windowSeconds])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgb(15_23_42/0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[18px] font-extrabold text-slate-950">
            {t.exoskeleton.jointOverviewTitle}
          </h2>
          <p className="m-0 mt-1 text-xs font-semibold text-slate-500">
            {t.exoskeleton.telemetryWindow(windowSeconds)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((entry) => (
            <button
              key={entry}
              type="button"
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-extrabold transition-colors',
                metric === entry
                  ? 'border-slate-950 bg-slate-950 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400',
              )}
              onClick={() => setMetric(entry)}
            >
              {metricLabel(entry, t)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-[300px] max-[680px]:h-[240px]">
        {chartData.length < 2 ? (
          <div className="grid h-full place-items-center">
            <p className="m-0 text-sm font-semibold text-slate-500">
              {t.exoskeleton.telemetryChartWaiting}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
              <CartesianGrid stroke="rgb(226 232 240)" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={[0, windowSeconds]}
                ticks={ticks}
                allowDataOverflow
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickFormatter={(value) => {
                  const age = windowSeconds - Number(value)
                  return age <= 0 ? 'now' : `-${Math.round(age)}s`
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                width={44}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(value) => {
                  const age = windowSeconds - Number(value)
                  return age <= 0
                    ? t.exoskeleton.telemetrySecondsAgo(0)
                    : t.exoskeleton.telemetrySecondsAgo(age)
                }}
              />
              <Legend iconType="circle" wrapperStyle={{ color: '#64748b', fontSize: 12 }} />
              {JOINT_IDS.map((id) => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={id}
                  name={jointLabel(id, t)}
                  stroke={JOINT_COLOR[id]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
})
