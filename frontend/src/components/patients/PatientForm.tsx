import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n/context'
import type { Patient, PatientCreate, Sex } from '../../types/patients'
import {
  workflowBtnPrimary,
  workflowBtnSecondary,
  workflowField,
  workflowFieldInput,
  workflowFieldLabel,
  uiSelect,
  workflowModal,
  workflowModalActions,
  workflowModalBackdrop,
  workflowModalPanel,
} from '../../styles/ui'

type PatientFormProps = {
  open: boolean
  mode: 'create' | 'edit'
  initial?: Patient | null
  pending: boolean
  onClose: () => void
  onSubmit: (data: PatientCreate) => Promise<void>
}

const SEX_OPTIONS: Sex[] = ['M', 'F', 'other', 'unknown']

export function PatientForm({ open, mode, initial, pending, onClose, onSubmit }: PatientFormProps) {
  const { t } = useI18n()
  const [displayName, setDisplayName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [sex, setSex] = useState<Sex>('unknown')
  const [diagnosisNote, setDiagnosisNote] = useState('')

  useEffect(() => {
    if (!open) return
    setDisplayName(initial?.display_name ?? '')
    setDateOfBirth(initial?.date_of_birth ?? '')
    setSex(initial?.sex ?? 'unknown')
    setDiagnosisNote(initial?.diagnosis_note ?? '')
  }, [open, initial])

  if (!open) return null

  const sexLabel = (value: Sex) => {
    switch (value) {
      case 'M':
        return t.workflow.sexM
      case 'F':
        return t.workflow.sexF
      case 'other':
        return t.workflow.sexOther
      default:
        return t.workflow.sexUnknown
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!displayName.trim()) return
    await onSubmit({
      display_name: displayName.trim(),
      date_of_birth: dateOfBirth || null,
      sex,
      diagnosis_note: diagnosisNote.trim() || null,
    })
  }

  return createPortal(
    <div className={workflowModal} role="dialog" aria-modal="true">
      <div className={workflowModalBackdrop} onClick={onClose} />
      <form className={workflowModalPanel} onSubmit={(e) => void handleSubmit(e)}>
        <header>
          <h2 className="m-0">
            {mode === 'create' ? t.workflow.createPatient : t.workflow.editPatient}
          </h2>
        </header>

        <label className={workflowField}>
          <span className={workflowFieldLabel}>{t.workflow.displayName}</span>
          <input
            type="text"
            className={workflowFieldInput}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label className={workflowField}>
          <span className={workflowFieldLabel}>{t.workflow.dateOfBirth}</span>
          <input
            type="date"
            className={workflowFieldInput}
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />
        </label>

        <label className={workflowField}>
          <span className={workflowFieldLabel}>{t.workflow.sex}</span>
          <select
            className={uiSelect}
            value={sex}
            onChange={(e) => setSex(e.target.value as Sex)}
          >
            {SEX_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {sexLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className={workflowField}>
          <span className={workflowFieldLabel}>{t.workflow.diagnosisNote}</span>
          <textarea
            className={workflowFieldInput}
            value={diagnosisNote}
            onChange={(e) => setDiagnosisNote(e.target.value)}
            rows={3}
          />
        </label>

        <footer className={workflowModalActions}>
          <button type="button" className={workflowBtnSecondary} onClick={onClose}>
            {t.workflow.cancel}
          </button>
          <button type="submit" className={workflowBtnPrimary} disabled={pending}>
            {t.workflow.save}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  )
}
