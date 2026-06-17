export type Sex = 'M' | 'F' | 'other' | 'unknown'

export type Patient = {
  id: string
  display_name: string
  date_of_birth: string | null
  sex: Sex
  diagnosis_note: string | null
  profile: Record<string, unknown>
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type PatientCreate = {
  display_name: string
  date_of_birth?: string | null
  sex: Sex
  diagnosis_note?: string | null
  profile?: Record<string, unknown>
}

export type PatientUpdate = {
  display_name?: string
  date_of_birth?: string | null
  sex?: Sex
  diagnosis_note?: string | null
  profile?: Record<string, unknown>
}
