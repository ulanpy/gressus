import { apiDelete, apiGet, apiPatch, apiPost } from './client'
import type { Patient, PatientCreate, PatientDto, PatientUpdate } from '../../types/patients'

function fromPatientDto(dto: PatientDto): Patient {
  const { patient_id, ...rest } = dto
  return { id: patient_id, ...rest }
}

export function listPatients(includeArchived = false): Promise<Patient[]> {
  return apiGet<PatientDto[]>('/patients', { include_archived: includeArchived }).then((rows) =>
    rows.map(fromPatientDto),
  )
}

export function createPatient(data: PatientCreate): Promise<Patient> {
  return apiPost<PatientDto>('/patients', data).then(fromPatientDto)
}

export function getPatient(patientId: string): Promise<Patient> {
  return apiGet<PatientDto>(`/patients/${patientId}`).then(fromPatientDto)
}

export function updatePatient(patientId: string, data: PatientUpdate): Promise<Patient> {
  return apiPatch<PatientDto>(`/patients/${patientId}`, data).then(fromPatientDto)
}

export function archivePatient(patientId: string): Promise<Patient> {
  return apiDelete<PatientDto>(`/patients/${patientId}`).then(fromPatientDto)
}
