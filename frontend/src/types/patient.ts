import type { PatientContactKey } from './navigation'
import type { PatientMessageKey } from './i18n'

export type PatientSuggestionState = {
  contactKey: PatientContactKey
  lastSuggestionStep: number
  message: PatientMessageKey
  stepCount: number
}
