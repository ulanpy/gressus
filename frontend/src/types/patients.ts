export type Sex = 'M' | 'F' | 'other' | 'unknown'

/** Normalized patient (API `patient_id` mapped to `id`). */
export type Patient = {
  id: string
  display_name: string
  date_of_birth: string | null
  sex: Sex
  cp_type: string | null
  affected_side: string | null
  gmfcs_current: string | null
  dominant_side: string | null
  comorbidities: string | null
  contraindications: string | null
  consent_on_file: boolean
  consent_date: string | null
  guardian_contact: string | null
  enrollment_date: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type PatientCreate = {
  display_name: string
  date_of_birth?: string | null
  sex: Sex
  cp_type?: string | null
  affected_side?: string | null
  gmfcs_current?: string | null
  dominant_side?: string | null
  comorbidities?: string | null
  contraindications?: string | null
  consent_on_file?: boolean
  consent_date?: string | null
  guardian_contact?: string | null
  enrollment_date?: string | null
}

export type PatientUpdate = {
  display_name?: string
  date_of_birth?: string | null
  sex?: Sex
  cp_type?: string | null
  affected_side?: string | null
  gmfcs_current?: string | null
  dominant_side?: string | null
  comorbidities?: string | null
  contraindications?: string | null
  consent_on_file?: boolean
  consent_date?: string | null
  guardian_contact?: string | null
  enrollment_date?: string | null
}

/** Raw API response shape. */
export type PatientDto = Omit<Patient, 'id'> & { patient_id: string }
