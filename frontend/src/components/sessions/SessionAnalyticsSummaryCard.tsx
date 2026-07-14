import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n/context'
import {
  parseSessionAnalyticsBundle,
  SESSION_ASPECT_KEYS,
  type SessionAspectKey,
  type SessionAnalyticsSummary as Summary,
} from '../../lib/analytics/sessionSummary'
import { cn } from '../../lib/cn'
import type { TherapySession } from '../../types/sessions'

type SessionAnalyticsSummaryProps = {
  session: TherapySession | null
}

type Scope = 'session' | number

const ASPECT_TO_CEMRR: Record<SessionAspectKey, 'S' | 'V' | 'B' | 'E' | 'STR'> = {
  symmetry: 'S',
  stability: 'V',
  support: 'B',
  efficiency: 'E',
  strength: 'STR',
}

const ASPECT_COLOR: Record<SessionAspectKey, string> = {
  symmetry: '#3b82f6',
  stability: '#8b5cf6',
  support: 'rgb(16 185 129)',
  efficiency: 'rgb(245 158 11)',
  strength: 'rgb(248 113 113)',
}

function formatNum(value: number | null, digits = 2, suffix = ''): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(digits)}${suffix}`
}

function formatPct01(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value * 100)}%`
}

function griColor(value: number | null): string {
  if (value == null) return '#64748b'
  if (value >= 0.65) return 'rgb(16 185 129)'
  if (value >= 0.35) return 'rgb(245 158 11)'
  return 'rgb(248 113 113)'
}

function Metric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-extrabold text-slate-950">{value}</div>
    </div>
  )
}

function SummaryBody({ summary }: { summary: Summary }) {
  const { t } = useI18n()
  const cemrr = t.progress.cemrr

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-4"
          style={{ borderColor: griColor(summary.gri) }}
        >
          <div className="text-center leading-none">
            <div className="text-lg font-extrabold" style={{ color: griColor(summary.gri) }}>
              {formatPct01(summary.gri)}
            </div>
            <div className="mt-0.5 text-[10px] font-bold text-slate-500">{cemrr.griLabel}</div>
          </div>
        </div>

        <div className="min-w-0 flex-1 grid gap-2">
          {SESSION_ASPECT_KEYS.map((key) => {
            const value = summary.aspects[key]
            const pct = value == null ? 0 : Math.round(Math.max(0, Math.min(1, value)) * 100)
            return (
              <div key={key} className="grid grid-cols-[88px_minmax(0,1fr)_40px] items-center gap-2">
                <span className="truncate text-xs font-semibold text-slate-600">
                  {cemrr.aspects[ASPECT_TO_CEMRR[key]]}
                </span>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: ASPECT_COLOR[key] }}
                  />
                </div>
                <span
                  className="text-right text-xs font-extrabold"
                  style={{ color: ASPECT_COLOR[key] }}
                >
                  {formatPct01(value)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label={cemrr.tCadence} value={formatNum(summary.cadenceStepsPerMin, 1)} />
        <Metric label={cemrr.slStride} value={formatNum(summary.strideLengthMeanM, 3, ' m')} />
        <Metric label={cemrr.slStepL} value={formatNum(summary.stepLengthLeftM, 3, ' m')} />
        <Metric label={cemrr.slStepR} value={formatNum(summary.stepLengthRightM, 3, ' m')} />
        <Metric label={t.workflow.strideTimeL} value={formatNum(summary.strideTimeLeftS, 3, ' s')} />
        <Metric label={t.workflow.strideTimeR} value={formatNum(summary.strideTimeRightS, 3, ' s')} />
        <Metric label={cemrr.slSI} value={formatNum(summary.stepLengthSiPct, 1, '%')} />
        <Metric
          label={t.workflow.strideTimeSi}
          value={formatNum(summary.strideTimeSiPct, 1, '%')}
        />
      </div>
    </div>
  )
}

export function SessionAnalyticsSummaryCard({ session }: SessionAnalyticsSummaryProps) {
  const { t } = useI18n()
  const bundle = useMemo(
    () => (session ? parseSessionAnalyticsBundle(session.analytics_metrics) : null),
    [session],
  )
  const [scope, setScope] = useState<Scope>('session')

  useEffect(() => {
    setScope('session')
  }, [session?.id])

  if (!session || session.analytics_status !== 'ready' || !bundle) {
    return null
  }

  const activeSummary =
    scope === 'session'
      ? bundle.session
      : (bundle.episodes.find((ep) => ep.episodeIndex === scope) ?? bundle.session)

  const title =
    scope === 'session'
      ? t.workflow.sessionAnalyticsSummary
      : t.workflow.episodeSummary(scope + 1)

  return (
    <section
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-4',
        'shadow-[0_12px_30px_rgb(15_23_42/0.04)]',
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-base font-extrabold text-slate-950">{title}</h3>
          <p className="m-0 mt-1 text-xs font-semibold text-slate-500">
            {t.workflow.sessionNumber(session.session_number ?? 0)}
            {bundle.episodes.length > 0
              ? ` · ${t.workflow.episodeCount(bundle.episodes.length)}`
              : ''}
            {activeSummary.durationS != null
              ? ` · ${formatNum(activeSummary.durationS / 60, 1)} ${t.workflow.minutesShort}`
              : ''}
          </p>
        </div>

        {bundle.episodes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-extrabold transition-colors',
                scope === 'session'
                  ? 'border-slate-950 bg-slate-950 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400',
              )}
              onClick={() => setScope('session')}
            >
              {t.workflow.scopeSession}
            </button>
            {bundle.episodes.map((ep) => {
              const index = ep.episodeIndex ?? 0
              const selected = scope === index
              return (
                <button
                  key={index}
                  type="button"
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-extrabold transition-colors',
                    selected
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400',
                  )}
                  onClick={() => setScope(index)}
                >
                  {t.workflow.scopeEpisode(index + 1)}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
      <SummaryBody summary={activeSummary} />
    </section>
  )
}
