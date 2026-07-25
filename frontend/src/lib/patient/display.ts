import type { Language } from '../../types/i18n'
import type { Sex } from '../../types/patients'
import { dateLocale } from '../dateLocale'

type SexLabels = {
  sexM: string
  sexF: string
  sexOther: string
  sexUnknown: string
}

export function patientSexLabel(sex: Sex, labels: SexLabels): string {
  switch (sex) {
    case 'M':
      return labels.sexM
    case 'F':
      return labels.sexF
    case 'other':
      return labels.sexOther
    default:
      return labels.sexUnknown
  }
}

export function patientAgeYears(dateOfBirth: string): number | null {
  const born = new Date(dateOfBirth)
  if (Number.isNaN(born.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - born.getFullYear()
  const monthDelta = today.getMonth() - born.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate())) {
    age -= 1
  }
  return age >= 0 ? age : null
}

export function formatPatientDateOfBirth(dateOfBirth: string, language: Language): string {
  return new Intl.DateTimeFormat(dateLocale(language), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateOfBirth))
}

export function formatPatientDateLong(dateOfBirth: string, language: Language): string {
  return new Intl.DateTimeFormat(dateLocale(language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateOfBirth))
}
