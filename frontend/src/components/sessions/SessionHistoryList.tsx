import { formatDateOnly, formatDateTime } from '../../lib/format'
import { useI18n } from '../../i18n/context'
import type { TherapySession } from '../../types/sessions'
import { HistoryIcon } from '../patients/PatientFieldIcons'
import {
  sessionCardMeta,
  sessionHistory,
  sessionHistoryItem,
  sessionHistoryStatus,
} from '../../styles/ui'

type SessionHistoryListProps = {
  sessions: TherapySession[]
  activeSessionId: string | null
}

export function SessionHistoryList({ sessions, activeSessionId }: SessionHistoryListProps) {
  const { t, language } = useI18n()
  const history = sessions.filter((s) => s.id !== activeSessionId)

  if (history.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-slate-500">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-indigo-500">
          <HistoryIcon />
        </div>
        <p className="m-0 text-sm font-medium">{t.workflow.noSessionHistory}</p>
      </div>
    )
  }

  const statusLabel = (status: TherapySession['status']) => {
    switch (status) {
      case 'active':
        return t.workflow.statusActive
      case 'completed':
        return t.workflow.statusCompleted
      case 'failed':
        return t.workflow.statusFailed
      default:
        return t.workflow.statusAborted
    }
  }

  return (
    <ul className={sessionHistory}>
      {history.map((session) => {
        const primaryDate = session.started_at ?? session.created_at
        return (
          <li key={session.id} className={sessionHistoryItem}>
            <div>
              <strong>{t.workflow.sessionNumber(session.session_number ?? 0)}</strong>{' '}
              <span className={sessionHistoryStatus}>{statusLabel(session.status)}</span>
            </div>
            <div className={sessionCardMeta}>
              <span>
                {primaryDate
                  ? formatDateTime(primaryDate, language)
                  : session.session_date
                    ? formatDateOnly(session.session_date, language)
                    : ''}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
