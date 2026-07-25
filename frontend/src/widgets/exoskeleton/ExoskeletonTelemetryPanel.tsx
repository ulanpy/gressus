import { useEffect, type ReactNode } from 'react'
import { useI18n } from '@/i18n/context'
import {
  useExoskeletonTelemetry,
  type ExoskeletonControlFlags,
} from '@/hooks/useExoskeletonTelemetry'
import { useRuntimeStatus } from '@/hooks/useRuntimeStatus'
import { mapExoErrorDetail, resolveExoLinkStatus } from '@/lib/exoskeleton/statusText'
import { cn } from '@/shared/lib/utils'
import { LiveJointTelemetryChart } from '@/widgets/exoskeleton/LiveJointTelemetryChart'
import { ExoskeletonIcon } from '@/widgets/exoskeleton/ExoskeletonIcon'

export type ExoskeletonSessionState =
  | 'Idle'
  | 'Selecting Patient'
  | 'Arming'
  | 'Loading Profile'
  | 'Ready'
  | 'Running'
  | 'Stopping'
  | 'Calibrating'
  | 'Error'
  | 'E-STOP Active'

export type ExoskeletonStepStatus = 'idle' | 'running' | 'success' | 'error'

export type ExoskeletonProgressStep = {
  id: string
  label: string
  status: ExoskeletonStepStatus
  detail?: string
}

function stepIcon(status: ExoskeletonStepStatus) {
  if (status === 'success') return '✓'
  if (status === 'running') return '⟳'
  if (status === 'error') return '!'
  return '○'
}

function formatMs(value = 0) {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

function clampRatio(value: number) {
  return Math.max(0, Math.min(1, value))
}

function formatPct01(value: number): string {
  return `${Math.round(clampRatio(value) * 100)}%`
}

function LevelPairCard({
  title,
  hint,
  left,
  right,
  leftColor,
  rightColor,
  leftLabel,
  rightLabel,
}: {
  title: string
  hint: string
  left: number
  right: number
  leftColor: string
  rightColor: string
  leftLabel: string
  rightLabel: string
}) {
  const rows = [
    { label: leftLabel, value: left, color: leftColor },
    { label: rightLabel, value: right, color: rightColor },
  ] as const

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgb(15_23_42/0.04)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[15px] font-extrabold text-slate-950">{title}</div>
        <div className="text-[12px] font-semibold text-slate-500">{hint}</div>
      </div>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => {
          const pct = Math.round(clampRatio(row.value) * 100)
          return (
            <div key={row.label} className="grid grid-cols-[52px_minmax(0,1fr)_48px] items-center gap-3">
              <span className="text-xs font-extrabold text-slate-600">{row.label}</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-[width] duration-300 ease-out"
                  style={{ width: `${pct}%`, background: row.color }}
                />
              </div>
              <span className="text-right text-sm font-extrabold tabular-nums" style={{ color: row.color }}>
                {formatPct01(row.value)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ConnectingTelemetry({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgb(15_23_42/0.05)]">
      <div className="grid min-h-[420px] place-items-center text-center">
        <div className="grid justify-items-center gap-5">
          <div className="relative h-24 w-24">
            <div className="absolute inset-0 rounded-full border-8 border-slate-200" />
            <div className="absolute inset-0 animate-spin rounded-full border-8 border-transparent border-t-blue-500" />
          </div>
          <div>
            <h1 className="m-0 text-[24px] font-extrabold text-slate-950">{title}</h1>
            <p className="mt-2 mb-0 max-w-[360px] text-sm font-semibold leading-6 text-slate-500">{detail}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function InfoCard({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgb(15_23_42/0.04)]">
      <div className="text-[13px] font-extrabold text-slate-500">{label}</div>
      <div className="mt-3">{children}</div>
    </div>
  )
}

type ExoskeletonTelemetryPanelProps = {
  onFlagsChange: (flags: ExoskeletonControlFlags) => void
  progress: ExoskeletonProgressStep[]
  sessionState: ExoskeletonSessionState
}

export function ExoskeletonTelemetryPanel({
  onFlagsChange,
  progress,
  sessionState,
}: ExoskeletonTelemetryPanelProps) {
  const { t } = useI18n()
  const exo = t.exoskeleton
  const {
    snapshot: runtime,
    loading: statusLoading,
    error: statusError,
  } = useRuntimeStatus(true)
  const { frame: telemetry, history, flags, windowSeconds } = useExoskeletonTelemetry(true)
  const pgear = runtime?.pgear ?? null

  useEffect(() => {
    onFlagsChange(flags)
  }, [flags, onFlagsChange])

  if (statusLoading && !pgear) {
    return <ConnectingTelemetry title={exo.connectingTitle} detail={exo.connectingDetail} />
  }

  const link = resolveExoLinkStatus(pgear, statusError, t)
  const errorDetail =
    link.tone === 'waiting'
      ? mapExoErrorDetail(telemetry?.error, t)
      : mapExoErrorDetail(pgear?.error, t) ??
        mapExoErrorDetail(statusError, t) ??
        mapExoErrorDetail(telemetry?.error, t) ??
        link.detail
  const processStep =
    progress.find((step) => step.status === 'running') ??
    progress.find((step) => step.status === 'error') ??
    null
  const processStatus = processStep?.status ?? 'idle'
  const processText = processStep?.detail ?? processStep?.label ?? ''
  const showProcessBadge = processStatus === 'running' || processStatus === 'error'

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgb(15_23_42/0.05)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em] text-slate-950">
            {exo.telemetryTitle}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showProcessBadge ? (
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-extrabold',
                processStatus === 'running' && 'bg-blue-100 text-blue-700',
                processStatus === 'error' && 'bg-red-100 text-red-700',
              )}
            >
              <span className="grid h-4 w-4 place-items-center text-[13px] leading-none">
                {stepIcon(processStatus)}
              </span>
              {processText}
            </span>
          ) : null}
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-extrabold',
              link.tone === 'connected' && 'bg-emerald-100 text-emerald-700',
              link.tone === 'waiting' && 'bg-amber-100 text-amber-800',
              link.tone === 'lost' && 'bg-red-100 text-red-700',
              link.tone === 'unavailable' && 'bg-red-100 text-red-700',
            )}
          >
            <ExoskeletonIcon name="wifi" className="h-4 w-4" />
            {link.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 max-[1180px]:grid-cols-2 max-[680px]:grid-cols-1">
        <InfoCard label="Session State">
          <div className="text-[26px] font-extrabold text-slate-950">{sessionState}</div>
        </InfoCard>
        <InfoCard label="Gait Phase">
          <div className="text-[26px] font-extrabold text-slate-950">{telemetry?.gaitPhaseName ?? 'Idle'}</div>
        </InfoCard>
        <InfoCard label="Step Index">
          <div className="text-[26px] font-extrabold text-slate-950">{telemetry?.stepIdx ?? 0}</div>
        </InfoCard>
        <InfoCard label="Link Age">
          <div
            className={cn(
              'text-[26px] font-extrabold',
              (telemetry?.linkAgeMs ?? 9999) > 500 ? 'text-red-600' : 'text-emerald-600',
            )}
          >
            {formatMs(telemetry?.linkAgeMs ?? 9999)} ms
          </div>
        </InfoCard>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 max-[680px]:grid-cols-1">
        <LevelPairCard
          title={exo.assistPairTitle}
          hint={exo.assistPairHint}
          leftLabel={exo.sideLeft}
          rightLabel={exo.sideRight}
          left={telemetry?.assistL ?? 0}
          right={telemetry?.assistR ?? 0}
          leftColor="#7c3aed"
          rightColor="#0ea5e9"
        />
        <LevelPairCard
          title={exo.amplitudePairTitle}
          hint={exo.amplitudePairHint}
          leftLabel={exo.sideLeft}
          rightLabel={exo.sideRight}
          left={telemetry?.ampL ?? 0}
          right={telemetry?.ampR ?? 0}
          leftColor="#8b5cf6"
          rightColor="#2563eb"
        />
      </div>

      <div className="mt-4">
        <LiveJointTelemetryChart history={history} windowSeconds={windowSeconds} />
      </div>

      <div className="mt-4">
        <InfoCard label="Error Message">
          <div className={cn('text-[16px] font-extrabold', errorDetail ? 'text-red-600' : 'text-slate-500')}>
            {errorDetail ?? exo.errorNone}
          </div>
        </InfoCard>
      </div>
    </section>
  )
}
