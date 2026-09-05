import { formatDateOnly, formatDateTime } from '../../lib/format'
import { sessionRosbagDownloadUrl } from '../../lib/api/sessions'
import { useI18n } from '../../i18n/context'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import type { TherapySession } from '../../types/sessions'
import { HistoryIcon } from '@/widgets/patients/PatientFieldIcons'
import { SessionAnthropometricsLine } from './SessionAnthropometricsLine'
import { SessionStatusIcon } from './SessionStatusIcon'
import { Download } from 'lucide-react'

type SessionHistoryListProps = {
  patientId: string
  sessions: TherapySession[]
  activeSessionId: string | null
  selectedSessionId?: string | null
  onSelectSession?: (sessionId: string) => void
  className?: string
}

export function SessionHistoryList({
  patientId,
  sessions,
  activeSessionId,
  selectedSessionId = null,
  onSelectSession,
  className,
}: SessionHistoryListProps) {
  const { t, language } = useI18n()
  const history = sessions.filter((s) => s.id !== activeSessionId)

  if (history.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-slate-500',
          className,
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-indigo-500">
          <HistoryIcon />
        </div>
        <p className="m-0 text-sm font-medium">{t.workflow.noSessionHistory}</p>
      </div>
    )
  }

  return (
    <ul className={cn('m-0 grid list-none gap-1.5 p-0', className)}>
      {history.map((session) => {
        const primaryDate = session.started_at ?? session.created_at
        const selected = session.id === selectedSessionId
        const interactive = Boolean(onSelectSession)
        const dateLabel = primaryDate
          ? formatDateTime(primaryDate, language)
          : session.session_date
            ? formatDateOnly(session.session_date, language)
            : ''

        return (
          <li key={session.id} className="flex items-stretch gap-1.5">
            <Button
              type="button"
              variant="ghost"
              className={cn(
                'h-auto min-w-0 flex-1 flex-col items-stretch gap-1 rounded-xl border px-3 py-2.5 text-left font-normal whitespace-normal shadow-none',
                interactive ? 'cursor-pointer' : 'cursor-default',
                selected
                  ? 'border-slate-900 bg-white shadow-[0_8px_20px_rgb(15_23_42/0.06)] hover:bg-white'
                  : 'border-transparent bg-slate-50/80 hover:border-slate-200 hover:bg-white',
              )}
              disabled={!interactive}
              onClick={() => onSelectSession?.(session.id)}
            >
              <div className="flex items-center gap-2">
                <strong className="text-sm">
                  {t.workflow.sessionNumber(session.session_number ?? 0)}
                </strong>
                <SessionStatusIcon status={session.status} />
              </div>
              <span className="text-xs text-slate-500">{dateLabel}</span>
              <SessionAnthropometricsLine
                anthropometrics={session.anthropometrics}
                className="block text-xs text-slate-500"
              />
            </Button>
            <Button
              asChild
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 shrink-0 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              title={t.workflow.downloadRosbag}
            >
              <a
                href={sessionRosbagDownloadUrl(patientId, session.id)}
                download
                aria-label={t.workflow.downloadRosbag}
                onClick={(event) => event.stopPropagation()}
              >
                <Download className="size-4" />
                {t.workflow.downloadRosbagShort}
              </a>
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
