import { useState } from 'react'
import { useI18n } from '../../i18n/context'
import type { PatientSessionWorkflow } from '../../hooks/usePatientSessionWorkflow'
import { formatDateTime } from '../../lib/format'
import {
  sessionCard,
  sessionCardMeta,
  sessionHistoryBlock,
  workflowBtnPrimary,
  workflowField,
  workflowFieldInput,
  workflowFieldLabel,
  workflowMuted,
  workflowStep,
} from '../../styles/ui'
import { SessionHistoryList } from './SessionHistoryList'

type SessionPanelProps = {
  workflow: PatientSessionWorkflow
}

export function SessionPanel({ workflow }: SessionPanelProps) {
  const { t, language } = useI18n()
  const [notes, setNotes] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)

  const handleStart = async () => {
    await workflow.startSession(notes.trim() || null)
    setNotes('')
  }

  return (
    <section className={workflowStep} aria-label={t.workflow.startSession}>
      {workflow.activeSession ? (
        <article className={sessionCard}>
          <div>
            <p className="m-0 text-xs font-bold tracking-[0.08em] text-muted uppercase">
              {t.workflow.activeSession}
            </p>
            <h3 className="mt-1 mb-0 text-lg text-text-strong">
              {t.workflow.sessionNumber(workflow.activeSession.session_number)}
            </h3>
            <p className={sessionCardMeta}>
              {t.workflow.statusActive} ·{' '}
              {formatDateTime(workflow.activeSession.started_at, language)}
            </p>
          </div>
        </article>
      ) : (
        <div className="grid gap-3">
          <p className={workflowMuted}>{t.workflow.noActiveSession}</p>
          <label className={workflowField}>
            <span className={workflowFieldLabel}>{t.workflow.notes}</span>
            <textarea
              className={workflowFieldInput}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={!workflow.selectedPatient || workflow.pendingAction}
            />
          </label>
          <button
            type="button"
            className={workflowBtnPrimary}
            onClick={() => void handleStart()}
            disabled={!workflow.selectedPatient || workflow.pendingAction}
          >
            {t.workflow.startSession}
          </button>
        </div>
      )}

      {workflow.sessions.length > 0 && (
        <div className={sessionHistoryBlock}>
          <button
            type="button"
            className="border-0 bg-transparent p-0 text-sm font-semibold text-brand cursor-pointer hover:text-cyan-700"
            onClick={() => setHistoryOpen((open) => !open)}
            aria-expanded={historyOpen}
          >
            {historyOpen ? t.workflow.hideHistory : t.workflow.showHistory}
          </button>
          {historyOpen && (
            <SessionHistoryList
              sessions={workflow.sessions}
              activeSessionId={workflow.activeSession?.id ?? null}
            />
          )}
        </div>
      )}
    </section>
  )
}
