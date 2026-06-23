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
const CP_TYPE_OPTIONS = [
  'spastic diplegia',
  'spastic hemiplegia',
  'spastic quadriplegia',
  'dyskinetic',
  'ataxic',
] as const
const SIDE_OPTIONS = ['left', 'right'] as const
const GMFCS_OPTIONS = ['I', 'II', 'III', 'IV', 'V'] as const
const OTHER_OPTION = '__other__'

function optionOrExisting(value: string, options: readonly string[]) {
  if (!value || options.includes(value)) return value
  return OTHER_OPTION
}

const modalPanelClass = cn(
  workflowModalPanel,
  'patient-form-scroll max-h-[85vh] max-w-[560px] gap-0 overflow-y-auto',
)
const modalTitleClass = 'm-0 text-2xl font-bold tracking-[-0.025em] text-text-strong'
const sectionClass = 'm-0 border-0 p-0 pt-6'
const dividedSectionClass = cn(sectionClass, 'mt-6 border-t border-slate-200/80')
const sectionTitleClass =
  'mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand'
const patientFieldClass = cn(workflowField, 'mt-4 gap-1.5')
const patientFieldLabelClass = cn(
  workflowFieldLabel,
  'text-xs font-semibold tracking-[0.01em] text-slate-500',
)

export function PatientForm({ open, mode, initial, pending, onClose, onSubmit }: PatientFormProps) {
  const { t } = useI18n()
  const [displayName, setDisplayName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [sex, setSex] = useState<Sex>('unknown')
  const [cpType, setCpType] = useState('')
  const [cpTypeOther, setCpTypeOther] = useState('')
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
    const initialCpType = initial?.cp_type ?? ''
    const initialAffectedSide = initial?.affected_side?.toLowerCase() ?? ''
    const initialGmfcs = initial?.gmfcs_current?.toUpperCase() ?? ''
    const initialDominantSide = initial?.dominant_side?.toLowerCase() ?? ''
    setCpType(optionOrExisting(initialCpType, CP_TYPE_OPTIONS))
    setCpTypeOther(CP_TYPE_OPTIONS.includes(initialCpType as (typeof CP_TYPE_OPTIONS)[number]) ? '' : initialCpType)
    setAffectedSide(optionOrExisting(initialAffectedSide, SIDE_OPTIONS))
    setGmfcsCurrent(optionOrExisting(initialGmfcs, GMFCS_OPTIONS))
    setDominantSide(optionOrExisting(initialDominantSide, SIDE_OPTIONS))
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
      cp_type: (cpType === OTHER_OPTION ? cpTypeOther : cpType).trim() || null,
      affected_side: (affectedSide === OTHER_OPTION ? initial?.affected_side ?? '' : affectedSide).trim() || null,
      gmfcs_current: (gmfcsCurrent === OTHER_OPTION ? initial?.gmfcs_current ?? '' : gmfcsCurrent).trim() || null,
      dominant_side: (dominantSide === OTHER_OPTION ? initial?.dominant_side ?? '' : dominantSide).trim() || null,
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
          <h2 className={modalTitleClass}>
            {mode === 'create' ? t.workflow.createPatient : t.workflow.editPatient}
          </h2>
        </header>

        <fieldset className={sectionClass}>
          <legend className={sectionTitleClass}>{t.workflow.sectionBasic}</legend>

          <label className={patientFieldClass}>
            <span className={patientFieldLabelClass}>{t.workflow.displayName}</span>
            <input
              type="text"
              className={workflowFieldInput}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoFocus
            />
          </label>

          <label className={patientFieldClass}>
            <span className={patientFieldLabelClass}>{t.workflow.dateOfBirth}</span>
            <input
              type="date"
              className={workflowDateInput}
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </label>

          <label className={patientFieldClass}>
            <span className={patientFieldLabelClass}>{t.workflow.sex}</span>
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

        <fieldset className={dividedSectionClass}>
          <legend className={sectionTitleClass}>{t.workflow.sectionClinical}</legend>

          <label className={patientFieldClass}>
            <span className={patientFieldLabelClass}>{t.workflow.cpType}</span>
            <select
              className="ui-select [font:inherit]"
              value={cpType}
              onChange={(e) => setCpType(e.target.value)}
            >
              <option value="">{t.workflow.selectOption}</option>
              {CP_TYPE_OPTIONS.map((option, index) => (
                <option key={option} value={option}>
                  {t.workflow.cpTypeOptions[index]}
                </option>
              ))}
              <option value={OTHER_OPTION}>{t.workflow.otherOption}</option>
            </select>
          </label>

          {cpType === OTHER_OPTION && (
            <label className={patientFieldClass}>
              <span className={patientFieldLabelClass}>{t.workflow.otherCpType}</span>
              <input
                type="text"
                className={workflowFieldInput}
                value={cpTypeOther}
                onChange={(e) => setCpTypeOther(e.target.value)}
              />
            </label>
          )}

          <label className={patientFieldClass}>
            <span className={patientFieldLabelClass}>{t.workflow.affectedSide}</span>
            <select
              className="ui-select [font:inherit]"
              value={affectedSide}
              onChange={(e) => setAffectedSide(e.target.value)}
            >
              <option value="">{t.workflow.selectOption}</option>
              <option value="left">{t.workflow.sideLeft}</option>
              <option value="right">{t.workflow.sideRight}</option>
              {affectedSide === OTHER_OPTION && (
                <option value={OTHER_OPTION}>{initial?.affected_side}</option>
              )}
            </select>
          </label>

          <label className={patientFieldClass}>
            <span className={patientFieldLabelClass}>{t.workflow.gmfcsCurrent}</span>
            <select
              className="ui-select [font:inherit]"
              value={gmfcsCurrent}
              onChange={(e) => setGmfcsCurrent(e.target.value)}
            >
              <option value="">{t.workflow.selectOption}</option>
              {GMFCS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              {gmfcsCurrent === OTHER_OPTION && (
                <option value={OTHER_OPTION}>{initial?.gmfcs_current}</option>
              )}
            </select>
          </label>

          <label className={patientFieldClass}>
            <span className={patientFieldLabelClass}>{t.workflow.dominantSide}</span>
            <select
              className="ui-select [font:inherit]"
              value={dominantSide}
              onChange={(e) => setDominantSide(e.target.value)}
            >
              <option value="">{t.workflow.selectOption}</option>
              <option value="left">{t.workflow.sideLeft}</option>
              <option value="right">{t.workflow.sideRight}</option>
              {dominantSide === OTHER_OPTION && (
                <option value={OTHER_OPTION}>{initial?.dominant_side}</option>
              )}
            </select>
          </label>

          <label className={patientFieldClass}>
            <span className={patientFieldLabelClass}>{t.workflow.comorbidities}</span>
            <textarea
              className={workflowFieldInput}
              value={comorbidities}
              onChange={(e) => setComorbidities(e.target.value)}
              rows={2}
            />
          </label>

          <label className={patientFieldClass}>
            <span className={patientFieldLabelClass}>{t.workflow.contraindications}</span>
            <textarea
              className={workflowFieldInput}
              value={contraindications}
              onChange={(e) => setContraindications(e.target.value)}
              rows={2}
            />
          </label>
        </fieldset>

        <fieldset className={dividedSectionClass}>
          <legend className={sectionTitleClass}>{t.workflow.sectionConsent}</legend>

          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={consentOnFile}
              onChange={(e) => setConsentOnFile(e.target.checked)}
            />
            <span>{t.workflow.consentOnFile}</span>
          </label>

          <label className={patientFieldClass}>
            <span className={patientFieldLabelClass}>{t.workflow.consentDate}</span>
            <input
              type="date"
              className={workflowDateInput}
              value={consentDate}
              onChange={(e) => setConsentDate(e.target.value)}
            />
          </label>

          <label className={patientFieldClass}>
            <span className={patientFieldLabelClass}>{t.workflow.guardianContact}</span>
            <input
              type="text"
              className={workflowFieldInput}
              value={guardianContact}
              onChange={(e) => setGuardianContact(e.target.value)}
            />
          </label>

          <label className={patientFieldClass}>
            <span className={patientFieldLabelClass}>{t.workflow.enrollmentDate}</span>
            <input
              type="date"
              className={workflowDateInput}
              value={enrollmentDate}
              onChange={(e) => setEnrollmentDate(e.target.value)}
            />
          </label>
        </fieldset>

        <footer className={cn(workflowModalActions, 'mt-6 border-t border-slate-200/80 pt-5')}>
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
