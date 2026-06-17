import { formatDateTime } from '../../lib/format'
import { useI18n } from '../../i18n/context'
import type { TherapySession } from '../../types/sessions'

type SessionHistoryListProps = {
  sessions: TherapySession[]
  activeSessionId: string | null
}

export function SessionHistoryList({ sessions, activeSessionId }: SessionHistoryListProps) {
  const { t, language } = useI18n()
  const history = sessions.filter((s) => s.id !== activeSessionId)

  if (history.length === 0) {
    return <p className="workflow-muted">{t.workflow.noSessionHistory}</p>
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
    <ul className="session-history">
      {history.map((session) => (
        <li key={session.id} className="session-history__item">
          <div>
            <strong>{t.workflow.sessionNumber(session.session_number)}</strong>
            <span className="session-history__status">{statusLabel(session.status)}</span>
          </div>
          <div className="session-history__meta">
            <span>{formatDateTime(session.started_at, language)}</span>
            {session.ended_at && <span>→ {formatDateTime(session.ended_at, language)}</span>}
          </div>
          {session.notes && <p className="session-history__notes">{session.notes}</p>}
        </li>
      ))}
    </ul>
  )
}
