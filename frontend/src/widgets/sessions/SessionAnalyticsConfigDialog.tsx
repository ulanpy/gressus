import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/i18n/context'
import {
  excludedEpisodeIndexes,
  parseSessionAnalyticsBundle,
} from '@/lib/analytics/sessionSummary'
import { updateSession } from '@/lib/api/sessions'
import { cn } from '@/shared/lib/utils'
import { SESSION_NOTES_MAX_LENGTH, type TherapySession } from '@/types/sessions'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'

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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onClose()
      }}
    >
      <DialogContent className="max-h-[min(88vh,720px)] max-w-[520px] gap-4 overflow-y-auto sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t.workflow.editAnalyticsConfig}</DialogTitle>
          <DialogDescription>
            {t.workflow.sessionNumber(session.session_number ?? 0)} ·{' '}
            {t.workflow.editAnalyticsConfigHint}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="session-notes">{t.workflow.sessionNotes}</Label>
          <Textarea
            id="session-notes"
            className="min-h-[88px] resize-y break-all rounded-2xl border-0 bg-slate-50 focus-visible:ring-slate-300"
            value={notes}
            maxLength={SESSION_NOTES_MAX_LENGTH}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t.workflow.sessionNotesPlaceholder}
          />
          <span className="text-right text-xs text-muted-foreground">
            {t.workflow.sessionNotesCharCount(notes.length, SESSION_NOTES_MAX_LENGTH)}
          </span>
        </div>

        <div className="grid gap-2">
          <div>
            <span className="text-sm font-semibold text-foreground">
              {t.workflow.episodesInSummary}
            </span>
            <p className="m-0 mt-0.5 text-xs text-muted-foreground">
              {t.workflow.episodesInSummaryHint}
            </p>
          </div>

          {episodes.length === 0 ? (
            <p className="m-0 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-muted-foreground">
              {t.workflow.noEpisodesToConfigure}
            </p>
          ) : (
            <ul className="m-0 grid list-none gap-2 p-0">
              {episodes.map((ep) => {
                const index = ep.episodeIndex ?? 0
                const included = !excluded.has(index)
                return (
                  <li key={index}>
                    <div
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 transition-colors',
                        included ? 'bg-slate-50' : 'bg-slate-50/60 opacity-65',
                      )}
                    >
                      <Label
                        htmlFor={`episode-${index}`}
                        className="min-w-0 cursor-pointer font-normal"
                      >
                        <span className="block text-sm font-semibold text-foreground">
                          {t.workflow.episodeSummary(index + 1)}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {formatDuration(ep.durationS)}
                          {ep.gri != null ? ` · GRI ${Math.round(ep.gri * 100)}%` : ''}
                        </span>
                      </Label>
                      <Checkbox
                        id={`episode-${index}`}
                        checked={included}
                        onCheckedChange={() => toggle(index)}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {error ? <p className="m-0 text-sm font-semibold text-red-600">{error}</p> : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {t.workflow.cancel}
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleSave()}>
            {saving ? t.workflow.saving : t.workflow.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
