import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n/context'
import type { Patient, PatientCreate, Sex } from '../../types/patients'
import {
  workflowBtnPrimary,
  workflowBtnSecondary,
  workflowField,
  workflowFieldInput,
  workflowDateInput,
  workflowFieldLabel,
  workflowModal,
  workflowModalActions,
  workflowModalBackdrop,
  workflowModalPanel,
} from '../../styles/ui'
import { cn } from '../../lib/cn'

type PatientFormProps = {
  open: boolean
  mode: 'create' | 'edit'
  initial?: Patient | null
  pending: boolean
  onClose: () => void
  onSubmit: (data: PatientCreate) => Promise<void>
}

const SEX_OPTIONS: Sex[] = ['M', 'F', 'other', 'unknown']

const modalPanelClass = cn(
  workflowModalPanel,
  'max-h-[85vh] max-w-[560px] overflow-y-auto',
)

export function PatientForm({ open, mode, initial, pending, onClose, onSubmit }: PatientFormProps) {
  const { t } = useI18n()
  const [displayName, setDisplayName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [sex, setSex] = useState<Sex>('unknown')
  const [cpType, setCpType] = useState('')
  const [affectedSide, setAffectedSide] = useState('')
  const [gmfcsCurrent, setGmfcsCurrent] = useState('')
  const [dominantSide, setDominantSide] = useState('')
  const [comorbidities, setComorbidities] = useState('')
  const [contraindications, setContraindications] = useState('')
  const [consentOnFile, setConsentOnFile] = useState(false)
  const [consentDate, setConsentDate] = useState('')
  const [guardianContact, setGuardianContact] = useState('')
  const [enrollmentDate, setEnrollmentDate] = useState('')

  useEffect(() => {
    if (!open) return
    setDisplayName(initial?.display_name ?? '')
    setDateOfBirth(initial?.date_of_birth ?? '')
    setSex(initial?.sex ?? 'unknown')
    setCpType(initial?.cp_type ?? '')
    setAffectedSide(initial?.affected_side ?? '')
    setGmfcsCurrent(initial?.gmfcs_current ?? '')
    setDominantSide(initial?.dominant_side ?? '')
    setComorbidities(initial?.comorbidities ?? '')
    setContraindications(initial?.contraindications ?? '')
    setConsentOnFile(initial?.consent_on_file ?? false)
    setConsentDate(initial?.consent_date ?? '')
    setGuardianContact(initial?.guardian_contact ?? '')
    setEnrollmentDate(initial?.enrollment_date ?? '')
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
      cp_type: cpType.trim() || null,
      affected_side: affectedSide.trim() || null,
      gmfcs_current: gmfcsCurrent.trim() || null,
      dominant_side: dominantSide.trim() || null,
      comorbidities: comorbidities.trim() || null,
      contraindications: contraindications.trim() || null,
      consent_on_file: consentOnFile,
      consent_date: consentDate || null,
      guardian_contact: guardianContact.trim() || null,
      enrollment_date: enrollmentDate || null,
    })
  }

  return createPortal(
    <div className={workflowModal} role="dialog" aria-modal="true">
      <div className={workflowModalBackdrop} onClick={onClose} />
      <form className={modalPanelClass} onSubmit={(e) => void handleSubmit(e)}>
        <header>
          <h2 className="m-0">
            {mode === 'create' ? t.workflow.createPatient : t.workflow.editPatient}
          </h2>
        </header>

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-1 text-sm font-bold text-text-strong">{t.workflow.sectionBasic}</legend>

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
              className={workflowDateInput}
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </label>

          <label className={workflowField}>
            <span className={workflowFieldLabel}>{t.workflow.sex}</span>
            <select
              className="ui-select [font:inherit]"
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
        </fieldset>

        <fieldset className="m-0 mt-2 border-0 border-t border-panel-border p-0 pt-3">
          <legend className="mb-1 text-sm font-bold text-text-strong">{t.workflow.sectionClinical}</legend>

          <label className={workflowField}>
            <span className={workflowFieldLabel}>{t.workflow.cpType}</span>
            <input
              type="text"
              className={workflowFieldInput}
              value={cpType}
              onChange={(e) => setCpType(e.target.value)}
            />
          </label>

          <label className={workflowField}>
            <span className={workflowFieldLabel}>{t.workflow.affectedSide}</span>
            <input
              type="text"
              className={workflowFieldInput}
              value={affectedSide}
              onChange={(e) => setAffectedSide(e.target.value)}
            />
          </label>

          <label className={workflowField}>
            <span className={workflowFieldLabel}>{t.workflow.gmfcsCurrent}</span>
            <input
              type="text"
              className={workflowFieldInput}
              value={gmfcsCurrent}
              onChange={(e) => setGmfcsCurrent(e.target.value)}
            />
          </label>

          <label className={workflowField}>
            <span className={workflowFieldLabel}>{t.workflow.dominantSide}</span>
            <input
              type="text"
              className={workflowFieldInput}
              value={dominantSide}
              onChange={(e) => setDominantSide(e.target.value)}
            />
          </label>

          <label className={workflowField}>
            <span className={workflowFieldLabel}>{t.workflow.comorbidities}</span>
            <textarea
              className={workflowFieldInput}
              value={comorbidities}
              onChange={(e) => setComorbidities(e.target.value)}
              rows={2}
            />
          </label>

          <label className={workflowField}>
            <span className={workflowFieldLabel}>{t.workflow.contraindications}</span>
            <textarea
              className={workflowFieldInput}
              value={contraindications}
              onChange={(e) => setContraindications(e.target.value)}
              rows={2}
            />
          </label>
        </fieldset>

        <fieldset className="m-0 mt-2 border-0 border-t border-panel-border p-0 pt-3">
          <legend className="mb-1 text-sm font-bold text-text-strong">{t.workflow.sectionConsent}</legend>

          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={consentOnFile}
              onChange={(e) => setConsentOnFile(e.target.checked)}
            />
            <span>{t.workflow.consentOnFile}</span>
          </label>

          <label className={workflowField}>
            <span className={workflowFieldLabel}>{t.workflow.consentDate}</span>
            <input
              type="date"
              className={workflowDateInput}
              value={consentDate}
              onChange={(e) => setConsentDate(e.target.value)}
            />
          </label>

          <label className={workflowField}>
            <span className={workflowFieldLabel}>{t.workflow.guardianContact}</span>
            <input
              type="text"
              className={workflowFieldInput}
              value={guardianContact}
              onChange={(e) => setGuardianContact(e.target.value)}
            />
          </label>

          <label className={workflowField}>
            <span className={workflowFieldLabel}>{t.workflow.enrollmentDate}</span>
            <input
              type="date"
              className={workflowDateInput}
              value={enrollmentDate}
              onChange={(e) => setEnrollmentDate(e.target.value)}
            />
          </label>
        </fieldset>

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
