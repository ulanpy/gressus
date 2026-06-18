import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n/context'
import {
  workflowBtnPrimary,
  workflowBtnSecondary,
  workflowField,
  workflowFieldInput,
  workflowFieldLabel,
  workflowModal,
  workflowModalActions,
  workflowModalBackdrop,
  workflowModalPanel,
} from '../../styles/ui'

type SessionStartModalProps = {
  open: boolean
  pending: boolean
  onClose: () => void
  onStart: (notes: string | null) => Promise<void>
}

export function SessionStartModal({ open, pending, onClose, onStart }: SessionStartModalProps) {
  const { t } = useI18n()
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) setNotes('')
  }, [open])

  if (!open) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    await onStart(notes.trim() || null)
    onClose()
  }

  return createPortal(
    <div className={workflowModal} role="dialog" aria-modal="true">
      <div className={workflowModalBackdrop} onClick={onClose} />
      <form className={workflowModalPanel} onSubmit={(e) => void handleSubmit(e)}>
        <header>
          <h2 className="m-0">{t.workflow.startSession}</h2>
        </header>

        <label className={workflowField}>
          <span className={workflowFieldLabel}>{t.workflow.notes}</span>
          <textarea
            className={workflowFieldInput}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={t.workflow.notesPlaceholder}
            autoFocus
          />
        </label>

        <footer className={workflowModalActions}>
          <button type="button" className={workflowBtnSecondary} onClick={onClose}>
            {t.workflow.cancel}
          </button>
          <button type="submit" className={workflowBtnPrimary} disabled={pending}>
            {t.workflow.startSession}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  )
}
