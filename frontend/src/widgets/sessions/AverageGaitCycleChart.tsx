import { useMemo, useState } from 'react'
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
  GAIT_CYCLE_JOINTS,
  parseAverageGaitCycle,
  type AverageGaitCycleJoint,
  type GaitCycleJointId,
} from '../../lib/analytics/averageGaitCycle'
import { cn } from '@/shared/lib/utils'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import type { AnalyticsStatus, TherapySession } from '../../types/sessions'

type AverageGaitCycleChartProps = {
  session: TherapySession | null
  compact?: boolean
}

function formatDeg(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(2)}°`
}

function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(0)}%`
}

function jointLabel(id: GaitCycleJointId, t: ReturnType<typeof useI18n>['t']): string {
  switch (id) {
    case 'HR':
      return t.workflow.jointHR
    case 'HL':
      return t.workflow.jointHL
    case 'KR':
      return t.workflow.jointKR
    case 'KL':
      return t.workflow.jointKL
  }
}

function analyticsStatusMessage(
  status: AnalyticsStatus | null | undefined,
  t: ReturnType<typeof useI18n>['t'],
): string {
  switch (status) {
    case 'pending':
    case 'processing':
      return t.workflow.analyticsPending
    case 'failed':
      return t.workflow.analyticsFailed
    case 'ready':
      return t.workflow.analyticsNoCycle
    default:
      return t.workflow.analyticsUnavailable
  }
}

function JointSummary({ joint, compact = false }: { joint: AverageGaitCycleJoint; compact?: boolean }) {
  const { t } = useI18n()
  return (
    <dl
      className={cn(
        'm-0 grid text-sm',
        compact ? 'grid-cols-2 gap-x-3 gap-y-1.5' : 'grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4',
      )}
    >
      <div>
        <dt className="m-0 text-[11px] font-semibold text-slate-500">{t.workflow.cycleRmse}</dt>
        <dd className="m-0 mt-0.5 font-extrabold text-slate-900">{formatDeg(joint.summary.rmseDeg)}</dd>
      </div>
      <div>
        <dt className="m-0 text-[11px] font-semibold text-slate-500">{t.workflow.cycleMae}</dt>
        <dd className="m-0 mt-0.5 font-extrabold text-slate-900">{formatDeg(joint.summary.maeDeg)}</dd>
      </div>
      <div>
        <dt className="m-0 text-[11px] font-semibold text-slate-500">{t.workflow.cycleMaxError}</dt>
        <dd className="m-0 mt-0.5 font-extrabold text-slate-900">
          {formatDeg(joint.summary.maxErrorDeg)}
        </dd>
      </div>
      <div>
        <dt className="m-0 text-[11px] font-semibold text-slate-500">{t.workflow.cycleCompliance}</dt>
        <dd className="m-0 mt-0.5 font-extrabold text-slate-900">
          {formatPct(joint.summary.compliance)}
        </dd>
      </div>
    </dl>
  )
}

export function AverageGaitCycleChart({ session, compact = false }: AverageGaitCycleChartProps) {
  const { t } = useI18n()
  const profile = useMemo(
    () => (session ? parseAverageGaitCycle(session.analytics_metrics) : null),
    [session],
  )
  const [jointId, setJointId] = useState<GaitCycleJointId>('HR')

  if (!session) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-sm font-medium text-slate-500">
        {t.workflow.selectSessionForAnalytics}
      </div>
    )
  }

  const activeJoint =
    profile?.joints.find((j) => j.id === jointId) ?? profile?.joints[0] ?? null

  if (!profile || !activeJoint || session.analytics_status !== 'ready') {
    return (
      <div
        className={cn(
          'rounded-2xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600',
          compact ? 'px-3 py-4' : 'px-4 py-5',
        )}
      >
        <p className="m-0 font-extrabold text-slate-900">
          {t.workflow.sessionNumber(session.session_number ?? 0)} · {t.workflow.averageGaitCycle}
        </p>
        <p className="m-0 mt-2">{analyticsStatusMessage(session.analytics_status, t)}</p>
      </div>
    )
  }

  const chartJoint = profile.joints.find((j) => j.id === jointId) ?? activeJoint
  const chartData = chartJoint.points.map((p) => ({
    phasePct: p.phasePct,
    refDeg: p.refDeg,
    actualDeg: p.actualDeg,
  }))

  const jointBtnClass = cn(
    'h-8 min-w-0 rounded-xl border border-border bg-white px-3 text-xs font-medium text-slate-600 shadow-panel',
    'hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40',
    'data-[state=on]:border-sky-200 data-[state=on]:bg-sky-50 data-[state=on]:text-sky-700 data-[state=on]:shadow-none',
    'data-[state=off]:bg-white',
    compact && 'h-7 px-2.5 text-[11px]',
  )

  return (
    <section
      className={cn(
        'rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgb(15_23_42/0.04)]',
        compact ? 'p-3' : 'p-4',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className={cn('m-0 font-extrabold text-slate-950', compact ? 'text-sm' : 'text-base')}>
            {t.workflow.averageGaitCycle}
          </h3>
          <p className="m-0 mt-0.5 text-[11px] font-semibold text-slate-500">
            {t.workflow.sessionNumber(session.session_number ?? 0)}
            {profile.cycleIntervalCount > 0
              ? ` · ${t.workflow.cycleCount(profile.cycleIntervalCount)}`
              : ''}
          </p>
        </div>
        <ToggleGroup
          type="single"
          spacing={1}
          value={chartJoint.id}
          onValueChange={(next) => {
            if (next) setJointId(next as GaitCycleJointId)
          }}
          className="flex flex-wrap justify-end gap-1.5 rounded-none"
        >
          {GAIT_CYCLE_JOINTS.map((id) => {
            const available = profile.joints.some((j) => j.id === id)
            return (
              <ToggleGroupItem
                key={id}
                value={id}
                disabled={!available}
                className={jointBtnClass}
              >
                {jointLabel(id, t)}
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </div>

      <div className={cn(compact ? 'mt-2.5' : 'mt-4')}>
        <JointSummary joint={chartJoint} compact={compact} />
      </div>

      <div
        className={cn(
          compact ? 'mt-2.5 h-[200px]' : 'mt-4 h-[280px] max-[640px]:h-[240px]',
        )}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={compact ? { top: 4, right: 8, bottom: 0, left: -16 } : { top: 8, right: 12, bottom: 0, left: -10 }}
          >
            <CartesianGrid stroke="rgb(226 232 240)" vertical={false} />
            <XAxis
              dataKey="phasePct"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#64748b', fontSize: compact ? 11 : 12 }}
              unit="%"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#64748b', fontSize: compact ? 11 : 12 }}
              unit="°"
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) =>
                typeof value === 'number' ? `${value.toFixed(2)}°` : String(value ?? '—')
              }
              labelFormatter={(label) => `${t.workflow.cyclePhase}: ${label}%`}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ color: '#64748b', fontSize: compact ? 11 : 12 }}
            />
            <Line
              type="monotone"
              dataKey="refDeg"
              name={t.workflow.cycleRef}
              stroke="#64748b"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="actualDeg"
              name={t.workflow.cycleActual}
              stroke="#0891b2"
              strokeWidth={2.5}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
