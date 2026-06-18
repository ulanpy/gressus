import { createPortal } from 'react-dom'
import {
  workflowBtnDanger,
  workflowBtnSecondary,
  workflowModal,
  workflowModalActions,
  workflowModalBackdrop,
  workflowModalPanel,
} from '../../styles/ui'

type ConfirmModalProps = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  pending?: boolean
  onConfirm: () => void | Promise<void>
  onClose: () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  pending = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!open) return null

  return createPortal(
    <div className={workflowModal} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className={workflowModalBackdrop} onClick={onClose} />
      <div className={workflowModalPanel}>
        <header>
          <h2 id="confirm-title" className="m-0 text-lg font-bold text-text-strong">
            {title}
          </h2>
        </header>
        <p className="m-0 text-sm leading-relaxed text-muted">{message}</p>
        <footer className={workflowModalActions}>
          <button type="button" className={workflowBtnSecondary} onClick={onClose} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={workflowBtnDanger}
            onClick={() => void onConfirm()}
            disabled={pending}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
