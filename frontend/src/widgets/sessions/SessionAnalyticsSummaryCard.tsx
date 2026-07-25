import { useMemo, useState } from 'react'
import { useI18n } from '../../i18n/context'
import {
  clinicalSessionSummary,
  excludedEpisodeIndexes,
  parseSessionAnalyticsBundle,
  SESSION_ASPECT_KEYS,
  type SessionAspectKey,
  type SessionAnalyticsSummary as Summary,
} from '../../lib/analytics/sessionSummary'
import { cn } from '@/shared/lib/utils'
import type { TherapySession } from '../../types/sessions'
import { Button } from '@/shared/ui/button'
import { PencilIcon } from '@/shared/ui/IconButton'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { SessionAnalyticsConfigDialog } from './SessionAnalyticsConfigDialog'

type SessionAnalyticsSummaryProps = {
  session: TherapySession | null
  onSessionUpdated?: (session: TherapySession) => void
  compact?: boolean
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
    <div className="min-w-0">
      <div className="truncate text-[10px] font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </div>
      <div className="mt-0.5 truncate text-[13px] font-bold tabular-nums text-slate-900">{value}</div>
    </div>
  )
}

function AspectStat({
  label,
  value,
  color,
}: {
  label: string
  value: number | null
  color: string
}) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-2 py-1.5 text-center">
      <div className="truncate text-[10px] font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 text-[13px] font-bold tabular-nums" style={{ color }}>
        {formatPct01(value)}
      </div>
    </div>
  )
}

function SummaryBody({ summary, compact = false }: { summary: Summary; compact?: boolean }) {
  const { t } = useI18n()
  const cemrr = t.progress.cemrr

  return (
    <div className={cn('grid', compact ? 'gap-2.5' : 'gap-3')}>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        <div
          className="min-w-0 rounded-xl px-2 py-1.5 text-center"
          style={{ background: `${griColor(summary.gri)}18` }}
        >
          <div className="truncate text-[10px] font-medium text-slate-500">{cemrr.griLabel}</div>
          <div
            className="mt-0.5 text-[13px] font-bold tabular-nums"
            style={{ color: griColor(summary.gri) }}
          >
            {formatPct01(summary.gri)}
          </div>
        </div>
        {SESSION_ASPECT_KEYS.map((key) => (
          <AspectStat
            key={key}
            label={cemrr.aspects[ASPECT_TO_CEMRR[key]]}
            value={summary.aspects[key]}
            color={ASPECT_COLOR[key]}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-2.5 sm:grid-cols-4">
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

export function SessionAnalyticsSummaryCard({
  session,
  onSessionUpdated,
  compact = false,
}: SessionAnalyticsSummaryProps) {
  const { t } = useI18n()
  const [effectiveSession, setEffectiveSession] = useState(session)
  const bundle = useMemo(
    () => (effectiveSession ? parseSessionAnalyticsBundle(effectiveSession.analytics_metrics) : null),
    [effectiveSession],
  )
  const excluded = useMemo(
    () => excludedEpisodeIndexes(effectiveSession?.analytics_config),
    [effectiveSession?.analytics_config],
  )
  const notes =
    typeof effectiveSession?.analytics_config?.notes === 'string'
      ? effectiveSession.analytics_config.notes.trim()
      : ''
  const [scope, setScope] = useState<Scope>('session')
  const [configOpen, setConfigOpen] = useState(false)

  if (!effectiveSession || effectiveSession.analytics_status !== 'ready' || !bundle) {
    return null
  }

  const clinical =
    clinicalSessionSummary(bundle.episodes, excluded) ?? bundle.session

  const activeSummary =
    scope === 'session'
      ? clinical
      : (bundle.episodes.find((ep) => ep.episodeIndex === scope) ?? clinical)

  const includedCount = bundle.episodes.filter(
    (ep) => ep.episodeIndex != null && !excluded.has(ep.episodeIndex),
  ).length

  const title =
    scope === 'session'
      ? t.workflow.sessionAnalyticsSummary
      : t.workflow.episodeSummary(scope + 1)

  const scopeBtnClass = cn(
    'h-8 min-w-0 rounded-xl border border-border bg-white px-3 text-xs font-medium text-slate-600 shadow-panel',
    'hover:bg-slate-50 hover:text-slate-800',
    'data-[state=on]:border-sky-200 data-[state=on]:bg-sky-50 data-[state=on]:text-sky-700 data-[state=on]:shadow-none',
    'data-[state=off]:bg-white',
    compact && 'h-7 px-2.5 text-[11px]',
  )

  return (
    <>
      <section
        className={cn(
          'min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white',
          'shadow-[0_12px_30px_rgb(15_23_42/0.04)]',
          compact ? 'p-3' : 'p-4',
        )}
      >
        <div className={cn('flex flex-wrap items-start justify-between gap-2', compact ? 'mb-2' : 'mb-3')}>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3
                className={cn(
                  'm-0 font-extrabold text-slate-950',
                  compact ? 'text-sm' : 'text-base',
                )}
              >
                {title}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 shrink-0 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => setConfigOpen(true)}
                title={t.workflow.editAnalyticsConfig}
                aria-label={t.workflow.editAnalyticsConfig}
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
            </div>
            <p className="m-0 mt-0.5 text-[11px] font-semibold text-slate-500">
              {t.workflow.sessionNumber(effectiveSession.session_number ?? 0)}
              {bundle.episodes.length > 0
                ? ` · ${t.workflow.includedEpisodeCount(includedCount, bundle.episodes.length)}`
                : ''}
              {activeSummary.durationS != null
                ? ` · ${formatNum(activeSummary.durationS / 60, 1)} ${t.workflow.minutesShort}`
                : ''}
            </p>
          </div>

          {bundle.episodes.length > 0 ? (
            <ToggleGroup
              type="single"
              spacing={1}
              value={String(scope)}
              onValueChange={(next) => {
                if (!next) return
                setScope(next === 'session' ? 'session' : Number(next))
              }}
              className="flex flex-wrap justify-end gap-1.5 rounded-none"
            >
              <ToggleGroupItem value="session" className={scopeBtnClass}>
                {t.workflow.scopeSession}
              </ToggleGroupItem>
              {bundle.episodes.map((ep) => {
                const index = ep.episodeIndex ?? 0
                const isExcluded = excluded.has(index)
                return (
                  <ToggleGroupItem
                    key={index}
                    value={String(index)}
                    className={cn(
                      scopeBtnClass,
                      isExcluded &&
                        'data-[state=off]:text-slate-400 data-[state=off]:line-through',
                    )}
                  >
                    {t.workflow.scopeEpisode(index + 1)}
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
          ) : null}
        </div>

        {scope === 'session' && includedCount === 0 ? (
          <p className="m-0 text-sm font-semibold text-slate-500">
            {t.workflow.noIncludedEpisodes}
          </p>
        ) : (
          <SummaryBody summary={activeSummary} compact={compact} />
        )}

        {notes ? (
          <p
            className="m-0 mt-2 min-w-0 max-w-full break-all line-clamp-2 text-[11px] leading-relaxed text-slate-400"
            title={notes}
          >
            <span className="font-semibold text-slate-500">{t.workflow.sessionNotes}: </span>
            {notes}
          </p>
        ) : null}
      </section>

      <SessionAnalyticsConfigDialog
        session={effectiveSession}
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onSaved={(updated) => {
          setEffectiveSession(updated)
          setScope('session')
          onSessionUpdated?.(updated)
        }}
      />
    </>
  )
}
