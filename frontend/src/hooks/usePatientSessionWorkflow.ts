import { useCallback, useEffect, useMemo, useState } from 'react'
import * as assessmentsApi from '../lib/api/assessments'
import * as patientsApi from '../lib/api/patients'
import * as sessionsApi from '../lib/api/sessions'
import { ApiError } from '../lib/api/client'
import type { Assessment, AssessmentCreate, AssessmentUpdate, BodyData, ObservationsData, SpatialGaitData, WalkingTestsData } from '../types/assessments'
import type { Patient, PatientCreate, PatientUpdate } from '../types/patients'
import type { SessionCreateBody, SessionStatus, TherapySession } from '../types/sessions'

const STORAGE_KEY = 'gressus:selectedPatientId'

function readStoredPatientId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredPatientId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    /* ignore */
  }
}

function findActiveSession(sessions: TherapySession[]): TherapySession | null {
  return sessions.find((s) => s.status === 'active') ?? null
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export type PatientSessionWorkflow = {
  patients: Patient[]
  selectedPatient: Patient | null
  selectedPatientId: string | null
  sessions: TherapySession[]
  assessments: Assessment[]
  activeSession: TherapySession | null
  loading: boolean
  pendingAction: boolean
  error: string | null
  canUseRuntime: boolean
  patientLocked: boolean
  refreshPatients: () => Promise<void>
  selectPatient: (patientId: string | null) => void
  createPatient: (data: PatientCreate) => Promise<Patient>
  updatePatient: (patientId: string, data: PatientUpdate) => Promise<Patient>
  archivePatient: (patientId: string) => Promise<void>
  refreshSessions: () => Promise<void>
  startSession: (data?: SessionCreateBody, patientId?: string) => Promise<TherapySession>
  endSession: (status?: Exclude<SessionStatus, 'active'>) => Promise<TherapySession>
  refreshAssessments: () => Promise<void>
  createAssessment: (data: AssessmentCreate) => Promise<Assessment>
  updateAssessment: (assessmentId: string, data: AssessmentUpdate) => Promise<Assessment>
  saveAssessmentBody: (assessmentId: string, data: BodyData) => Promise<Assessment>
  saveAssessmentSpatialGait: (assessmentId: string, data: SpatialGaitData) => Promise<Assessment>
  saveAssessmentWalkingTests: (assessmentId: string, data: WalkingTestsData) => Promise<Assessment>
  saveAssessmentObservations: (assessmentId: string, data: ObservationsData) => Promise<Assessment>
  clearError: () => void
}

export function usePatientSessionWorkflow(): PatientSessionWorkflow {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(readStoredPatientId)
  const [sessions, setSessions] = useState<TherapySession[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) ?? null,
    [patients, selectedPatientId],
  )

  const activeSession = useMemo(() => findActiveSession(sessions), [sessions])
  const canUseRuntime = activeSession?.status === 'active'
  const patientLocked = activeSession !== null

  const handleError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof ApiError) {
      setError(err.message)
    } else if (err instanceof Error) {
      setError(err.message)
    } else {
      setError(fallback)
    }
  }, [])

  const refreshPatients = useCallback(async () => {
    const list = await patientsApi.listPatients(false)
    setPatients(list)
    setSelectedPatientId((current) => {
      if (current && list.some((p) => p.id === current)) {
        return current
      }
      const stored = readStoredPatientId()
      if (stored && list.some((p) => p.id === stored)) {
        return stored
      }
      return list[0]?.id ?? null
    })
  }, [])

  const refreshSessions = useCallback(async () => {
    if (!selectedPatientId) {
      setSessions([])
      return
    }
    const list = await sessionsApi.listPatientSessions(selectedPatientId)
    setSessions(list)
  }, [selectedPatientId])

  const refreshAssessments = useCallback(async () => {
    if (!selectedPatientId) {
      setAssessments([])
      return
    }
    const list = await assessmentsApi.listPatientAssessments(selectedPatientId)
    setAssessments(list)
  }, [selectedPatientId])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        await refreshPatients()
      } catch (err) {
        if (!cancelled) {
          handleError(err, 'Не удалось загрузить пациентов')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [refreshPatients, handleError])

  useEffect(() => {
    if (!selectedPatientId) {
      setSessions([])
      setAssessments([])
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        await Promise.all([refreshSessions(), refreshAssessments()])
      } catch (err) {
        if (!cancelled) {
          handleError(err, 'Не удалось загрузить данные пациента')
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [selectedPatientId, refreshSessions, refreshAssessments, handleError])

  const selectPatient = useCallback((patientId: string | null) => {
    setSelectedPatientId(patientId)
    writeStoredPatientId(patientId)
    setError(null)
  }, [])

  const withPatientAction = useCallback(
    async <T>(fn: (patientId: string) => Promise<T>, fallback: string): Promise<T> => {
      if (!selectedPatientId) {
        throw new Error('Пациент не выбран')
      }
      setPendingAction(true)
      setError(null)
      try {
        return await fn(selectedPatientId)
      } catch (err) {
        handleError(err, fallback)
        throw err
      } finally {
        setPendingAction(false)
      }
    },
    [selectedPatientId, handleError],
  )

  const createPatient = useCallback(
    async (data: PatientCreate) => {
      setPendingAction(true)
      setError(null)
      try {
        const created = await patientsApi.createPatient(data)
        await refreshPatients()
        selectPatient(created.id)
        return created
      } catch (err) {
        handleError(err, 'Не удалось создать пациента')
        throw err
      } finally {
        setPendingAction(false)
      }
    },
    [refreshPatients, selectPatient, handleError],
  )

  const updatePatient = useCallback(
    async (patientId: string, data: PatientUpdate) => {
      setPendingAction(true)
      setError(null)
      try {
        const updated = await patientsApi.updatePatient(patientId, data)
        await refreshPatients()
        return updated
      } catch (err) {
        handleError(err, 'Не удалось обновить пациента')
        throw err
      } finally {
        setPendingAction(false)
      }
    },
    [refreshPatients, handleError],
  )

  const archivePatient = useCallback(
    async (patientId: string) => {
      setPendingAction(true)
      setError(null)
      try {
        await patientsApi.archivePatient(patientId)
        if (selectedPatientId === patientId) {
          selectPatient(null)
        }
        await refreshPatients()
      } catch (err) {
        handleError(err, 'Не удалось архивировать пациента')
        throw err
      } finally {
        setPendingAction(false)
      }
    },
    [selectedPatientId, selectPatient, refreshPatients, handleError],
  )

  const startSession = useCallback(
    async (data: SessionCreateBody = {}, forPatientId?: string) => {
      const patientId = forPatientId ?? selectedPatientId
      if (!patientId) {
        throw new Error('Пациент не выбран')
      }

      setPendingAction(true)
      setError(null)
      try {
        if (forPatientId && forPatientId !== selectedPatientId) {
          selectPatient(forPatientId)
        }

        const existing = await sessionsApi.listPatientSessions(patientId)
        if (findActiveSession(existing)) {
          throw new Error('У пациента уже есть активная сессия')
        }

        const created = await sessionsApi.createSession(patientId, {
          session_date: data.session_date ?? todayIsoDate(),
          ...data,
        })
        const next = await sessionsApi.listPatientSessions(patientId)
        setSessions(next)
        return created
      } catch (err) {
        handleError(err, 'Не удалось начать сессию')
        throw err
      } finally {
        setPendingAction(false)
      }
    },
    [selectedPatientId, selectPatient, handleError],
  )

  const endSession = useCallback(
    async (status: Exclude<SessionStatus, 'active'> = 'completed') => {
      if (!selectedPatientId || !activeSession) {
        throw new Error('Нет активной сессии')
      }
      setPendingAction(true)
      setError(null)
      try {
        const updated = await sessionsApi.updateSessionStatus(
          selectedPatientId,
          activeSession.id,
          status,
        )
        await refreshSessions()
        return updated
      } catch (err) {
        handleError(err, 'Не удалось завершить сессию')
        throw err
      } finally {
        setPendingAction(false)
      }
    },
    [selectedPatientId, activeSession, refreshSessions, handleError],
  )

  const createAssessment = useCallback(
    async (data: AssessmentCreate) =>
      withPatientAction(async (patientId) => {
        const created = await assessmentsApi.createAssessment(patientId, data)
        await refreshAssessments()
        return created
      }, 'Не удалось создать оценку'),
    [withPatientAction, refreshAssessments],
  )

  const updateAssessment = useCallback(
    async (assessmentId: string, data: AssessmentUpdate) =>
      withPatientAction(async (patientId) => {
        const updated = await assessmentsApi.updateAssessment(patientId, assessmentId, data)
        await refreshAssessments()
        return updated
      }, 'Не удалось обновить оценку'),
    [withPatientAction, refreshAssessments],
  )

  const saveAssessmentBody = useCallback(
    async (assessmentId: string, data: BodyData) =>
      withPatientAction(async (patientId) => {
        const updated = await assessmentsApi.setAssessmentBody(patientId, assessmentId, data)
        await refreshAssessments()
        return updated
      }, 'Не удалось сохранить антропометрию'),
    [withPatientAction, refreshAssessments],
  )

  const saveAssessmentSpatialGait = useCallback(
    async (assessmentId: string, data: SpatialGaitData) =>
      withPatientAction(async (patientId) => {
        const updated = await assessmentsApi.setAssessmentSpatialGait(
          patientId,
          assessmentId,
          data,
        )
        await refreshAssessments()
        return updated
      }, 'Не удалось сохранить пространственные параметры'),
    [withPatientAction, refreshAssessments],
  )

  const saveAssessmentWalkingTests = useCallback(
    async (assessmentId: string, data: WalkingTestsData) =>
      withPatientAction(async (patientId) => {
        const updated = await assessmentsApi.setAssessmentWalkingTests(
          patientId,
          assessmentId,
          data,
        )
        await refreshAssessments()
        return updated
      }, 'Не удалось сохранить тесты ходьбы'),
    [withPatientAction, refreshAssessments],
  )

  const saveAssessmentObservations = useCallback(
    async (assessmentId: string, data: ObservationsData) =>
      withPatientAction(async (patientId) => {
        const updated = await assessmentsApi.setAssessmentObservations(
          patientId,
          assessmentId,
          data,
        )
        await refreshAssessments()
        return updated
      }, 'Не удалось сохранить наблюдения'),
    [withPatientAction, refreshAssessments],
  )

  const clearError = useCallback(() => setError(null), [])

  return useMemo(
    () => ({
      patients,
      selectedPatient,
      selectedPatientId,
      sessions,
      assessments,
      activeSession,
      loading,
      pendingAction,
      error,
      canUseRuntime,
      patientLocked,
      refreshPatients,
      selectPatient,
      createPatient,
      updatePatient,
      archivePatient,
      refreshSessions,
      startSession,
      endSession,
      refreshAssessments,
      createAssessment,
      updateAssessment,
      saveAssessmentBody,
      saveAssessmentSpatialGait,
      saveAssessmentWalkingTests,
      saveAssessmentObservations,
      clearError,
    }),
    [
      patients,
      selectedPatient,
      selectedPatientId,
      sessions,
      assessments,
      activeSession,
      loading,
      pendingAction,
      error,
      canUseRuntime,
      patientLocked,
      refreshPatients,
      selectPatient,
      createPatient,
      updatePatient,
      archivePatient,
      refreshSessions,
      startSession,
      endSession,
      refreshAssessments,
      createAssessment,
      updateAssessment,
      saveAssessmentBody,
      saveAssessmentSpatialGait,
      saveAssessmentWalkingTests,
      saveAssessmentObservations,
      clearError,
    ],
  )
}
