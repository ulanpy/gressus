import { formatDateTime } from '../../lib/format'
import { useI18n } from '../../i18n/context'
import type { TherapySession } from '../../types/sessions'
import {
  sessionCardMeta,
  sessionHistory,
  sessionHistoryItem,
  sessionHistoryNotes,
  sessionHistoryStatus,
  workflowMuted,
} from '../../styles/ui'

type SessionHistoryListProps = {
  sessions: TherapySession[]
  activeSessionId: string | null
}

export function SessionHistoryList({ sessions, activeSessionId }: SessionHistoryListProps) {
  const { t, language } = useI18n()
  const history = sessions.filter((s) => s.id !== activeSessionId)

  if (history.length === 0) {
    return <p className={workflowMuted}>{t.workflow.noSessionHistory}</p>
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
      {history.map((session) => (
        <li key={session.id} className={sessionHistoryItem}>
          <div>
            <strong>{t.workflow.sessionNumber(session.session_number)}</strong>
            <span className={sessionHistoryStatus}>{statusLabel(session.status)}</span>
          </div>
          <div className={sessionCardMeta}>
            <span>{formatDateTime(session.started_at, language)}</span>
            {session.ended_at && <span>→ {formatDateTime(session.ended_at, language)}</span>}
          </div>
          {session.notes && <p className={sessionHistoryNotes}>{session.notes}</p>}
        </li>
      ))}
    </ul>
  )
}
