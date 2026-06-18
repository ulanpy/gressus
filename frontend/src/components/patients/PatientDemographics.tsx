import { useI18n } from '../../i18n/context'
import type { Patient } from '../../types/patients'
import {
  formatPatientDateOfBirth,
  patientAgeYears,
  patientSexLabel,
} from '../../lib/patient/display'
import { cn } from '../../lib/cn'

type PatientDemographicsProps = {
  patient: Patient
  className?: string
}

export function PatientDemographics({ patient, className }: PatientDemographicsProps) {
  const { t, language } = useI18n()

  const items: string[] = []

  if (patient.date_of_birth) {
    const dob = formatPatientDateOfBirth(patient.date_of_birth, language)
    const age = patientAgeYears(patient.date_of_birth)
    items.push(age == null ? dob : t.workflow.patientDobAge(dob, age))
  }

  if (patient.sex !== 'unknown') {
    items.push(patientSexLabel(patient.sex, t.workflow))
  }

  if (patient.diagnosis_note?.trim()) {
    items.push(patient.diagnosis_note.trim())
  }

  if (items.length === 0) {
    return (
      <p className={cn('m-0 mt-1 text-xs text-muted', className)}>
        {t.workflow.noDemographics}
      </p>
    )
  }

  return (
    <p className={cn('m-0 mt-1 text-xs leading-relaxed text-muted', className)}>
      {items.join(' · ')}
    </p>
  )
}
