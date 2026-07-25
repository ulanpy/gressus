import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useI18n } from '@/i18n/context'
import type { Patient, PatientCreate, Sex } from '@/types/patients'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { DatePicker } from '@/shared/ui/date-picker'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { cn } from '@/shared/lib/utils'

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

const sectionClass = 'm-0 border-0 p-0 pt-6'
const dividedSectionClass = cn(sectionClass, 'mt-6 border-t border-slate-200/80')
const sectionTitleClass = 'mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand'
const fieldClass = 'mt-4 grid gap-1.5'

function FormSelect({
  label,
  value,
  onValueChange,
  placeholder,
  children,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  children: ReactNode
}) {
  return (
    <div className={fieldClass}>
      <Label className="text-xs font-semibold tracking-[0.01em] text-slate-500">{label}</Label>
      <Select value={value || undefined} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  )
}

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

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next && !pending) onClose()
      }}
    >
      <DialogContent className="patient-form-scroll max-h-[85vh] max-w-[560px] gap-0 overflow-y-auto sm:rounded-3xl">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-[-0.025em]">
              {mode === 'create' ? t.workflow.createPatient : t.workflow.editPatient}
            </DialogTitle>
          </DialogHeader>

          <fieldset className={sectionClass}>
            <legend className={sectionTitleClass}>{t.workflow.sectionBasic}</legend>

            <div className={fieldClass}>
              <Label className="text-xs font-semibold tracking-[0.01em] text-slate-500">
                {t.workflow.displayName}
              </Label>
              <Input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className={fieldClass}>
              <Label className="text-xs font-semibold tracking-[0.01em] text-slate-500">
                {t.workflow.dateOfBirth}
              </Label>
              <DatePicker value={dateOfBirth} onChange={setDateOfBirth} />
            </div>

            <FormSelect label={t.workflow.sex} value={sex} onValueChange={(value) => setSex(value as Sex)}>
              {SEX_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {sexLabel(option)}
                </SelectItem>
              ))}
            </FormSelect>
          </fieldset>

          <fieldset className={dividedSectionClass}>
            <legend className={sectionTitleClass}>{t.workflow.sectionClinical}</legend>

            <FormSelect
              label={t.workflow.cpType}
              value={cpType}
              onValueChange={setCpType}
              placeholder={t.workflow.selectOption}
            >
              {CP_TYPE_OPTIONS.map((option, index) => (
                <SelectItem key={option} value={option}>
                  {t.workflow.cpTypeOptions[index]}
                </SelectItem>
              ))}
              <SelectItem value={OTHER_OPTION}>{t.workflow.otherOption}</SelectItem>
            </FormSelect>

            {cpType === OTHER_OPTION ? (
              <div className={fieldClass}>
                <Label className="text-xs font-semibold tracking-[0.01em] text-slate-500">
                  {t.workflow.otherCpType}
                </Label>
                <Input type="text" value={cpTypeOther} onChange={(e) => setCpTypeOther(e.target.value)} />
              </div>
            ) : null}

            <FormSelect
              label={t.workflow.affectedSide}
              value={affectedSide}
              onValueChange={setAffectedSide}
              placeholder={t.workflow.selectOption}
            >
              <SelectItem value="left">{t.workflow.sideLeft}</SelectItem>
              <SelectItem value="right">{t.workflow.sideRight}</SelectItem>
              {affectedSide === OTHER_OPTION && initial?.affected_side ? (
                <SelectItem value={OTHER_OPTION}>{initial.affected_side}</SelectItem>
              ) : null}
            </FormSelect>

            <FormSelect
              label={t.workflow.gmfcsCurrent}
              value={gmfcsCurrent}
              onValueChange={setGmfcsCurrent}
              placeholder={t.workflow.selectOption}
            >
              {GMFCS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
              {gmfcsCurrent === OTHER_OPTION && initial?.gmfcs_current ? (
                <SelectItem value={OTHER_OPTION}>{initial.gmfcs_current}</SelectItem>
              ) : null}
            </FormSelect>

            <FormSelect
              label={t.workflow.dominantSide}
              value={dominantSide}
              onValueChange={setDominantSide}
              placeholder={t.workflow.selectOption}
            >
              <SelectItem value="left">{t.workflow.sideLeft}</SelectItem>
              <SelectItem value="right">{t.workflow.sideRight}</SelectItem>
              {dominantSide === OTHER_OPTION && initial?.dominant_side ? (
                <SelectItem value={OTHER_OPTION}>{initial.dominant_side}</SelectItem>
              ) : null}
            </FormSelect>

            <div className={fieldClass}>
              <Label className="text-xs font-semibold tracking-[0.01em] text-slate-500">
                {t.workflow.comorbidities}
              </Label>
              <Textarea value={comorbidities} onChange={(e) => setComorbidities(e.target.value)} rows={2} />
            </div>

            <div className={fieldClass}>
              <Label className="text-xs font-semibold tracking-[0.01em] text-slate-500">
                {t.workflow.contraindications}
              </Label>
              <Textarea
                value={contraindications}
                onChange={(e) => setContraindications(e.target.value)}
                rows={2}
              />
            </div>
          </fieldset>

          <fieldset className={dividedSectionClass}>
            <legend className={sectionTitleClass}>{t.workflow.sectionConsent}</legend>

            <div className="mt-2 flex items-center gap-2">
              <Checkbox
                id="consent-on-file"
                checked={consentOnFile}
                onCheckedChange={(checked) => setConsentOnFile(checked === true)}
              />
              <Label htmlFor="consent-on-file" className="text-sm font-normal">
                {t.workflow.consentOnFile}
              </Label>
            </div>

            <div className={fieldClass}>
              <Label className="text-xs font-semibold tracking-[0.01em] text-slate-500">
                {t.workflow.consentDate}
              </Label>
              <DatePicker value={consentDate} onChange={setConsentDate} />
            </div>

            <div className={fieldClass}>
              <Label className="text-xs font-semibold tracking-[0.01em] text-slate-500">
                {t.workflow.guardianContact}
              </Label>
              <Input type="text" value={guardianContact} onChange={(e) => setGuardianContact(e.target.value)} />
            </div>

            <div className={fieldClass}>
              <Label className="text-xs font-semibold tracking-[0.01em] text-slate-500">
                {t.workflow.enrollmentDate}
              </Label>
              <DatePicker value={enrollmentDate} onChange={setEnrollmentDate} />
            </div>
          </fieldset>

          <DialogFooter className="mt-6 border-t border-slate-200/80 pt-5">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {t.workflow.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {t.workflow.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
