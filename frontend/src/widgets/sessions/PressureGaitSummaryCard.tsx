import { Footprints, Info } from 'lucide-react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type { TherapySession } from '@/types/sessions'
import { useI18n } from '@/i18n/context'
import { cn } from '@/shared/lib/utils'

type Props = { session: TherapySession; compact?: boolean }

function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function number(value: unknown, digits = 2, suffix = ''): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : '—'
}

function metric(source: Record<string, unknown> | null, key: string): unknown {
  return source?.[key]
}

export function hasPressureGaitAnalysis(session: TherapySession): boolean {
  const root = record(session.analytics_metrics)?.analytics
  const gait = record(record(root)?.session)
  const insole = record(gait?.insole)
  return insole?.eventSource === 'pressure_hysteresis_v1'
}

export function PressureGaitSummaryCard({ session, compact = false }: Props) {
  const { t } = useI18n()
  const root = record(session.analytics_metrics)?.analytics
  const gait = record(record(root)?.session)
  const timing = record(gait?.timing)
  const left = record(timing?.left)
  const right = record(timing?.right)
  const leftStride = record(left?.strideTime)
  const rightStride = record(right?.strideTime)

  const values = [
    [t.workflow.pressureCadence, number(timing?.cadenceStepsPerMin, 1, ` ${t.workflow.stepsPerMinute}`), t.workflow.pressureCadenceHint],
    [t.workflow.strideTimeL, number(metric(leftStride, 'mean'), 2, ` ${t.workflow.secondsShort}`), t.workflow.strideTimeHint],
    [t.workflow.strideTimeR, number(metric(rightStride, 'mean'), 2, ` ${t.workflow.secondsShort}`), t.workflow.strideTimeHint],
    [t.workflow.strideTimeSi, number(record(gait?.strideTime)?.symmetryIndexPct, 2, '%'), t.workflow.strideTimeSiHint],
    [t.workflow.stanceLeft, number(left?.stancePct, 1, '%'), t.workflow.stanceHint],
    [t.workflow.stanceRight, number(right?.stancePct, 1, '%'), t.workflow.stanceHint],
    [t.workflow.doubleSupport, number(timing?.doubleSupportRatioPct, 1, '%'), t.workflow.doubleSupportHint],
  ]

  return (
    <TooltipPrimitive.Provider delayDuration={120}>
      <section className={cn('rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgb(15_23_42/0.04)]', compact ? 'p-3' : 'p-4')}>
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
          <Footprints className="size-4" />
        </div>
        <div>
          <h3 className={cn('m-0 font-extrabold text-slate-950', compact ? 'text-sm' : 'text-base')}>
            {t.workflow.pressureGaitAnalysis}
          </h3>
          <p className="m-0 text-[11px] font-medium text-slate-500">{t.workflow.pressureDerivedEvents}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
        {values.map(([label, value, hint]) => (
          <div key={String(label)} className="min-w-0">
            <dt className="flex items-center gap-1 truncate text-[10px] font-medium tracking-wide text-slate-500 uppercase">
              <span className="truncate">{label}</span>
              <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>
                  <button type="button" className="inline-flex shrink-0 text-slate-400 outline-none hover:text-sky-700 focus-visible:text-sky-700" aria-label={String(hint)}>
                    <Info className="size-3" />
                  </button>
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                  <TooltipPrimitive.Content side="top" align="start" sideOffset={8} className="z-[100] w-56 rounded-md bg-slate-950 px-2.5 py-2 text-[11px] leading-snug font-medium normal-case tracking-normal text-white shadow-lg">
                    {hint}
                    <TooltipPrimitive.Arrow className="fill-slate-950" />
                  </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
              </TooltipPrimitive.Root>
            </dt>
            <dd className="m-0 mt-0.5 truncate text-[13px] font-bold tabular-nums text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      </section>
    </TooltipPrimitive.Provider>
  )
}
