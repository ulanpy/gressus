import { useEffect, useState } from 'react'
import { useI18n } from '@/i18n/context'
import type { Patient } from '@/types/patients'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'

type PatientPickModalProps = {
  open: boolean
  patients: Patient[]
  title: string
  description: string
  confirmLabel: string
  pending?: boolean
  initialPatientId?: string | null
  onConfirm: (patientId: string) => void | Promise<void>
  onClose: () => void
}

export function PatientPickModal({
  open,
  patients,
  title,
  description,
  confirmLabel,
  pending = false,
  initialPatientId = null,
  onConfirm,
  onClose,
}: PatientPickModalProps) {
  const { t } = useI18n()
  const [patientId, setPatientId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const preferred =
      initialPatientId && patients.some((p) => p.id === initialPatientId)
        ? initialPatientId
        : null
    setPatientId(preferred)
  }, [open, initialPatientId, patients])

  const empty = patients.length === 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {empty ? (
          <p className="m-0 text-sm text-muted-foreground">{t.workflow.noPatients}</p>
        ) : (
          <div className="grid gap-2">
            <Label className="field-label">{t.workflow.selectPatient}</Label>
            <Select
              value={patientId ?? undefined}
              onValueChange={(value) => setPatientId(value || null)}
              disabled={pending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t.workflow.selectPatientPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {patients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            {t.workflow.cancel}
          </Button>
          <Button
            type="button"
            disabled={pending || empty || !patientId}
            onClick={() => {
              if (patientId) void onConfirm(patientId)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
