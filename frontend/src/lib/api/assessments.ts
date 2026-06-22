import { apiGet, apiPatch, apiPost, apiPut } from './client'
import type {
  Assessment,
  AssessmentCreate,
  AssessmentDto,
  AssessmentUpdate,
  BodyData,
  ObservationsData,
  SpatialGaitData,
  WalkingTestsData,
} from '../../types/assessments'

function fromAssessmentDto(dto: AssessmentDto): Assessment {
  const { assessment_id, ...rest } = dto
  return { id: assessment_id, ...rest }
}

export function listPatientAssessments(patientId: string): Promise<Assessment[]> {
  return apiGet<AssessmentDto[]>(`/patients/${patientId}/assessments`).then((rows) =>
    rows.map(fromAssessmentDto),
  )
}

export function createAssessment(
  patientId: string,
  data: AssessmentCreate,
): Promise<Assessment> {
  return apiPost<AssessmentDto>(`/patients/${patientId}/assessments`, data).then(fromAssessmentDto)
}

export function getAssessment(patientId: string, assessmentId: string): Promise<Assessment> {
  return apiGet<AssessmentDto>(`/patients/${patientId}/assessments/${assessmentId}`).then(
    fromAssessmentDto,
  )
}

export function updateAssessment(
  patientId: string,
  assessmentId: string,
  data: AssessmentUpdate,
): Promise<Assessment> {
  return apiPatch<AssessmentDto>(`/patients/${patientId}/assessments/${assessmentId}`, data).then(
    fromAssessmentDto,
  )
}

export function setAssessmentBody(
  patientId: string,
  assessmentId: string,
  data: BodyData,
): Promise<Assessment> {
  return apiPut<AssessmentDto>(`/patients/${patientId}/assessments/${assessmentId}/body`, data).then(
    fromAssessmentDto,
  )
}

export function setAssessmentSpatialGait(
  patientId: string,
  assessmentId: string,
  data: SpatialGaitData,
): Promise<Assessment> {
  return apiPut<AssessmentDto>(
    `/patients/${patientId}/assessments/${assessmentId}/spatial-gait`,
    data,
  ).then(fromAssessmentDto)
}

export function setAssessmentWalkingTests(
  patientId: string,
  assessmentId: string,
  data: WalkingTestsData,
): Promise<Assessment> {
  return apiPut<AssessmentDto>(
    `/patients/${patientId}/assessments/${assessmentId}/walking-tests`,
    data,
  ).then(fromAssessmentDto)
}

export function setAssessmentObservations(
  patientId: string,
  assessmentId: string,
  data: ObservationsData,
): Promise<Assessment> {
  return apiPut<AssessmentDto>(
    `/patients/${patientId}/assessments/${assessmentId}/observations`,
    data,
  ).then(fromAssessmentDto)
}
