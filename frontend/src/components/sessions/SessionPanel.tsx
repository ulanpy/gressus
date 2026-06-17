import { useState } from 'react'
import { useI18n } from '../../i18n/context'
import type { PatientSessionWorkflow } from '../../hooks/usePatientSessionWorkflow'
import { formatDateTime } from '../../lib/format'
import { SessionHistoryList } from './SessionHistoryList'

type SessionPanelProps = {
  workflow: PatientSessionWorkflow
}

export function SessionPanel({ workflow }: SessionPanelProps) {
  const { t, language } = useI18n()
  const [notes, setNotes] = useState('')

  const handleStart = async () => {
    await workflow.startSession(notes.trim() || null)
    setNotes('')
  }

  const handleEnd = async () => {
    await workflow.endSession('completed')
  }

  return (
    <section className="workflow-step" aria-label={t.workflow.stepSession}>
      <header className="workflow-step__head">
        <p className="eyebrow">{t.workflow.stepSession}</p>
        <h2>
          {workflow.selectedPatient
            ? workflow.selectedPatient.display_name
            : t.workflow.selectPatientPlaceholder}
        </h2>
      </header>

      {workflow.activeSession ? (
        <article className="session-active-card">
          <div>
            <p className="eyebrow">{t.workflow.activeSession}</p>
            <h3>{t.workflow.sessionNumber(workflow.activeSession.session_number)}</h3>
            <p className="session-active-card__meta">
              {t.workflow.statusActive} · {formatDateTime(workflow.activeSession.started_at, language)}
            </p>
          </div>
          <button
            type="button"
            className="workflow-btn workflow-btn--danger"
            onClick={() => void handleEnd()}
            disabled={workflow.pendingAction}
          >
            {t.workflow.endSession}
          </button>
        </article>
      ) : (
        <div className="session-start-panel">
          <p className="workflow-muted">{t.workflow.noActiveSession}</p>
          <label className="workflow-field">
            <span>{t.workflow.notes}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={!workflow.selectedPatient || workflow.pendingAction}
            />
          </label>
          <button
            type="button"
            className="workflow-btn workflow-btn--primary"
            onClick={() => void handleStart()}
            disabled={!workflow.selectedPatient || workflow.pendingAction}
          >
            {t.workflow.startSession}
          </button>
        </div>
      )}

      <div className="session-history-block">
        <h3>{t.workflow.sessionHistory}</h3>
        <SessionHistoryList
          sessions={workflow.sessions}
          activeSessionId={workflow.activeSession?.id ?? null}
        />
      </div>
    </section>
  )
}
