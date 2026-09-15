import { formatDateOnly, formatLongDateTime } from '../../lib/format'
import { sessionRosbagDownloadUrl, updateSession } from '../../lib/api/sessions'
import { useState } from 'react'
import { useI18n } from '../../i18n/context'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import type { TherapySession } from '../../types/sessions'
import { HistoryIcon } from '@/widgets/patients/PatientFieldIcons'
import { SessionAnthropometricsLine } from './SessionAnthropometricsLine'
import { SessionStatusIcon } from './SessionStatusIcon'
import { Check, Download, Pencil, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'

type SessionHistoryListProps = {
  patientId: string
  sessions: TherapySession[]
  activeSessionId: string | null
  selectedSessionId?: string | null
  onSelectSession?: (sessionId: string) => void
  onSessionUpdated?: () => void | Promise<void>
  className?: string
}

export function SessionHistoryList({
  patientId,
  sessions,
  activeSessionId,
  selectedSessionId = null,
  onSelectSession,
  onSessionUpdated,
  className,
}: SessionHistoryListProps) {
  const { t, language } = useI18n()
  const [editing, setEditing] = useState<TherapySession | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  const [titleError, setTitleError] = useState<string | null>(null)
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

  const openTitleEditor = (session: TherapySession) => {
    setEditing(session)
    setDraftTitle(session.title ?? `Сеанс ${session.session_number ?? ''}`)
    setTitleError(null)
  }

  const saveTitle = async () => {
    if (!editing) return
    setSavingTitle(true)
    setTitleError(null)
    try {
      await updateSession(patientId, editing.id, { title: draftTitle.trim() || null })
      await onSessionUpdated?.()
      setEditing(null)
    } catch (error) {
      setTitleError(error instanceof Error ? error.message : 'Не удалось изменить название')
    } finally {
      setSavingTitle(false)
    }
  }

  return (
    <>
    <ul className={cn('m-0 grid list-none gap-1.5 p-0', className)}>
      {history.map((session) => {
        const primaryDate = session.started_at ?? session.created_at
        const selected = session.id === selectedSessionId
        const interactive = Boolean(onSelectSession)
        const dateLabel = primaryDate
          ? formatLongDateTime(primaryDate, language)
          : session.session_date
            ? formatDateOnly(session.session_date, language)
            : ''

        return (
          <li key={session.id} className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_2rem_2rem] items-start gap-1.5">
            <Button
              type="button"
              variant="ghost"
              className={cn(
                'min-h-28 min-w-0 flex-1 flex-col items-stretch gap-1 rounded-xl border px-3 py-2.5 text-left font-normal whitespace-normal shadow-none',
                interactive ? 'cursor-pointer' : 'cursor-default',
                selected
                  ? 'border-slate-900 bg-white shadow-[0_8px_20px_rgb(15_23_42/0.06)] hover:bg-white'
                  : 'border-transparent bg-slate-50/80 hover:border-slate-200 hover:bg-white',
              )}
              disabled={!interactive}
              onClick={() => onSelectSession?.(session.id)}
            >
              <div className="flex min-w-0 items-center gap-2">
                <strong className="truncate text-sm">{session.title ?? t.workflow.sessionNumber(session.session_number ?? 0)}</strong>
                <SessionStatusIcon status={session.status} />
              </div>
              <span className="text-xs text-slate-500">Сеанс №{session.session_number ?? '—'}</span>
              <span className="truncate text-xs text-slate-500" title={dateLabel}>{dateLabel}</span>
              <span className="min-h-4 truncate"><SessionAnthropometricsLine anthropometrics={session.anthropometrics} className="text-xs text-slate-500" /></span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="mt-1 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              title="Изменить название"
              aria-label="Изменить название сессии"
              onClick={(event) => {
                event.stopPropagation()
                openTitleEditor(session)
              }}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              asChild
              type="button"
              variant="ghost"
              size="icon-sm"
              className="mt-1 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              title={t.workflow.downloadRosbag}
            >
              <a
                href={sessionRosbagDownloadUrl(patientId, session.id)}
                download
                aria-label={t.workflow.downloadRosbag}
                onClick={(event) => event.stopPropagation()}
              >
                <Download className="size-4" />
              </a>
            </Button>
          </li>
        )
      })}
    </ul>
    <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && !savingTitle && setEditing(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Название сессии</DialogTitle><DialogDescription>Это название будет показано в истории и использовано для имени скачиваемого rosbag-архива.</DialogDescription></DialogHeader>
        <Input value={draftTitle} maxLength={160} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Например, Оценка ходьбы" autoFocus />
        {titleError ? <p role="alert" className="m-0 text-sm text-red-700">{titleError}</p> : null}
        <DialogFooter><Button type="button" variant="outline" disabled={savingTitle} onClick={() => setEditing(null)}><X />Отмена</Button><Button type="button" disabled={savingTitle} onClick={() => void saveTitle()}><Check />Сохранить</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
