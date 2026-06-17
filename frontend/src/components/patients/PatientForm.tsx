import { useEffect, useState, type FormEvent } from 'react'
import { useI18n } from '../../i18n/context'
import type { Patient, PatientCreate, Sex } from '../../types/patients'

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

  return (
    <div className="workflow-modal" role="dialog" aria-modal="true">
      <div className="workflow-modal__backdrop" onClick={onClose} />
      <form className="workflow-modal__panel" onSubmit={(e) => void handleSubmit(e)}>
        <header className="workflow-modal__head">
          <h2>{mode === 'create' ? t.workflow.createPatient : t.workflow.editPatient}</h2>
        </header>

        <label className="workflow-field">
          <span>{t.workflow.displayName}</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label className="workflow-field">
          <span>{t.workflow.dateOfBirth}</span>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />
        </label>

        <label className="workflow-field">
          <span>{t.workflow.sex}</span>
          <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            {SEX_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {sexLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="workflow-field">
          <span>{t.workflow.diagnosisNote}</span>
          <textarea
            value={diagnosisNote}
            onChange={(e) => setDiagnosisNote(e.target.value)}
            rows={3}
          />
        </label>

        <footer className="workflow-modal__actions">
          <button type="button" className="workflow-btn workflow-btn--secondary" onClick={onClose}>
            {t.workflow.cancel}
          </button>
          <button type="submit" className="workflow-btn workflow-btn--primary" disabled={pending}>
            {t.workflow.save}
          </button>
        </footer>
      </form>
    </div>
  )
}
