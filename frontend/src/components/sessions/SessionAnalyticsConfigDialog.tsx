import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n/context'
import {
  excludedEpisodeIndexes,
  parseSessionAnalyticsBundle,
} from '../../lib/analytics/sessionSummary'
import { updateSession } from '../../lib/api/sessions'
import { cn } from '../../lib/cn'
import { SESSION_NOTES_MAX_LENGTH, type TherapySession } from '../../types/sessions'
import {
  workflowBtnPrimary,
  workflowBtnSecondary,
  workflowModal,
  workflowModalActions,
  workflowModalBackdrop,
  workflowModalPanel,
} from '../../styles/ui'

type SessionAnalyticsConfigDialogProps = {
  session: TherapySession
  open: boolean
  onClose: () => void
  onSaved: (session: TherapySession) => void
}

function formatDuration(durationS: number | null): string {
  if (durationS == null || !Number.isFinite(durationS)) return '—'
  return `${(durationS / 60).toFixed(1)} min`
}

export function SessionAnalyticsConfigDialog({
  session,
  open,
  onClose,
  onSaved,
}: SessionAnalyticsConfigDialogProps) {
  const { t } = useI18n()
  const bundle = useMemo(
    () => parseSessionAnalyticsBundle(session.analytics_metrics),
    [session.analytics_metrics],
  )
  const [notes, setNotes] = useState('')
  const [excluded, setExcluded] = useState<Set<number>>(() => new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const cfg = session.analytics_config
    setNotes(typeof cfg?.notes === 'string' ? cfg.notes : '')
    setExcluded(excludedEpisodeIndexes(cfg))
    setError(null)
  }, [open, session.analytics_config, session.id])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, saving, onClose])

  if (!open) return null

  const episodes = bundle?.episodes ?? []

  const toggle = (index: number) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const trimmed = notes.trim()
      const updated = await updateSession(session.patient_id, session.id, {
        analytics_config: {
          ...(session.analytics_config ?? {}),
          excluded_episode_indexes: [...excluded].sort((a, b) => a - b),
          notes: trimmed.length > 0 ? trimmed : null,
        },
      })
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.workflow.apiError)
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className={workflowModal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-analytics-config-title"
    >
      <div className={workflowModalBackdrop} onClick={saving ? undefined : onClose} />
      <section
        className={cn(
          workflowModalPanel,
          'max-h-[min(88vh,720px)] max-w-[520px] gap-4 overflow-y-auto',
        )}
      >
        <header>
          <h2
            id="session-analytics-config-title"
            className="m-0 text-lg font-bold text-text-strong"
          >
            {t.workflow.editAnalyticsConfig}
          </h2>
          <p className="m-0 mt-1 text-sm text-muted">
            {t.workflow.sessionNumber(session.session_number ?? 0)} ·{' '}
            {t.workflow.editAnalyticsConfigHint}
          </p>
        </header>

        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-text-strong">{t.workflow.sessionNotes}</span>
          <textarea
            className="min-h-[88px] w-full resize-y break-all rounded-2xl border-0 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-text-strong outline-none ring-0 placeholder:text-slate-400 focus:bg-slate-100/90"
            value={notes}
            maxLength={SESSION_NOTES_MAX_LENGTH}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t.workflow.sessionNotesPlaceholder}
          />
          <span className="text-right text-xs text-muted">
            {t.workflow.sessionNotesCharCount(notes.length, SESSION_NOTES_MAX_LENGTH)}
          </span>
        </label>

        <div className="grid gap-2">
          <div>
            <span className="text-sm font-semibold text-text-strong">
              {t.workflow.episodesInSummary}
            </span>
            <p className="m-0 mt-0.5 text-xs text-muted">{t.workflow.episodesInSummaryHint}</p>
          </div>

          {episodes.length === 0 ? (
            <p className="m-0 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-muted">
              {t.workflow.noEpisodesToConfigure}
            </p>
          ) : (
            <ul className="m-0 grid list-none gap-2 p-0">
              {episodes.map((ep) => {
                const index = ep.episodeIndex ?? 0
                const included = !excluded.has(index)
                return (
                  <li key={index}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-3.5 py-3 transition-colors',
                        included ? 'bg-slate-50' : 'bg-slate-50/60 opacity-65',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-text-strong">
                          {t.workflow.episodeSummary(index + 1)}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {formatDuration(ep.durationS)}
                          {ep.gri != null ? ` · GRI ${Math.round(ep.gri * 100)}%` : ''}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-slate-300"
                        checked={included}
                        onChange={() => toggle(index)}
                      />
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {error ? <p className="m-0 text-sm font-semibold text-red-600">{error}</p> : null}

        <footer className={workflowModalActions}>
          <button
            type="button"
            className={workflowBtnSecondary}
            onClick={onClose}
            disabled={saving}
          >
            {t.workflow.cancel}
          </button>
          <button
            type="button"
            className={workflowBtnPrimary}
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? t.workflow.saving : t.workflow.save}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
