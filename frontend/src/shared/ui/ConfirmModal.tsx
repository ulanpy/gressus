import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'

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
  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next && !pending) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="destructive" onClick={() => void onConfirm()} disabled={pending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
