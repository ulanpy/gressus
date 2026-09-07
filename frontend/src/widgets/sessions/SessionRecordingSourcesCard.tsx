import { Database, Footprints, Radio } from 'lucide-react'
import type { TherapySession } from '@/types/sessions'
import { useI18n } from '@/i18n/context'
import { cn } from '@/shared/lib/utils'

type Props = {
  session: TherapySession
  compact?: boolean
}

function iconFor(id: string) {
  if (id === 'pressure_insoles') return Footprints
  if (id === 'pgear') return Radio
  return Database
}

export function SessionRecordingSourcesCard({ session, compact = false }: Props) {
  const { t } = useI18n()
  const sources = session.recording_sources ?? []

  return (
    <section
      className={cn(
        'rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgb(15_23_42/0.04)]',
        compact ? 'p-3' : 'p-4',
      )}
    >
      <h3 className={cn('m-0 font-extrabold text-slate-950', compact ? 'text-sm' : 'text-base')}>
        {t.workflow.recordedData}
      </h3>
      {sources.length ? (
        <div className="mt-2 grid gap-1.5">
          {sources.map((source) => {
            const Icon = iconFor(source.id)
            return (
              <div key={source.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-2">
                <Icon className="size-4 shrink-0 text-sky-600" />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">
                  {source.id === 'pressure_insoles' ? t.workflow.sourceInsoles : source.label}
                </span>
                <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-500">
                  {t.workflow.recordedMessages(source.message_count)}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="m-0 mt-1.5 text-xs font-medium text-slate-500">{t.workflow.noClinicalDataRecorded}</p>
      )}
    </section>
  )
}
