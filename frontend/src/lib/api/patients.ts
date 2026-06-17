import { apiDelete, apiGet, apiPatch, apiPost } from './client'
import type { Patient, PatientCreate, PatientUpdate } from '../../types/patients'

export function listPatients(includeArchived = false): Promise<Patient[]> {
  return apiGet<Patient[]>('/patients', { include_archived: includeArchived })
}

export function createPatient(data: PatientCreate): Promise<Patient> {
  return apiPost<Patient>('/patients', data)
}

export function getPatient(patientId: string): Promise<Patient> {
  return apiGet<Patient>(`/patients/${patientId}`)
}

export function updatePatient(patientId: string, data: PatientUpdate): Promise<Patient> {
  return apiPatch<Patient>(`/patients/${patientId}`, data)
}

export function archivePatient(patientId: string): Promise<Patient> {
  return apiDelete<Patient>(`/patients/${patientId}`)
}
