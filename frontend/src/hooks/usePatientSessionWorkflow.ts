import { useCallback, useEffect, useMemo, useState } from 'react'
import * as patientsApi from '../lib/api/patients'
import * as sessionsApi from '../lib/api/sessions'
import { ApiError } from '../lib/api/client'
import type { Patient, PatientCreate, PatientUpdate } from '../types/patients'
import type { SessionStatus, TherapySession } from '../types/sessions'

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

export type PatientSessionWorkflow = {
  patients: Patient[]
  selectedPatient: Patient | null
  selectedPatientId: string | null
  sessions: TherapySession[]
  activeSession: TherapySession | null
  loading: boolean
  pendingAction: boolean
  error: string | null
  canUseRuntime: boolean
  /** Lock patient CRUD / switch while a session is active. */
  patientLocked: boolean
  refreshPatients: () => Promise<void>
  selectPatient: (patientId: string | null) => void
  createPatient: (data: PatientCreate) => Promise<Patient>
  updatePatient: (patientId: string, data: PatientUpdate) => Promise<Patient>
  archivePatient: (patientId: string) => Promise<void>
  refreshSessions: () => Promise<void>
  startSession: (notes?: string | null) => Promise<TherapySession>
  endSession: (status?: Exclude<SessionStatus, 'active'>) => Promise<TherapySession>
  clearError: () => void
}

export function usePatientSessionWorkflow(): PatientSessionWorkflow {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(readStoredPatientId)
  const [sessions, setSessions] = useState<TherapySession[]>([])
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
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        await refreshSessions()
      } catch (err) {
        if (!cancelled) {
          handleError(err, 'Не удалось загрузить сессии')
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [selectedPatientId, refreshSessions, handleError])

  const selectPatient = useCallback((patientId: string | null) => {
    setSelectedPatientId(patientId)
    writeStoredPatientId(patientId)
    setError(null)
  }, [])

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
    async (notes?: string | null) => {
      if (!selectedPatientId) {
        throw new Error('Пациент не выбран')
      }
      if (activeSession) {
        throw new Error('У пациента уже есть активная сессия')
      }
      setPendingAction(true)
      setError(null)
      try {
        const created = await sessionsApi.createSession(selectedPatientId, {
          started_at: new Date().toISOString(),
          notes: notes ?? null,
        })
        await refreshSessions()
        return created
      } catch (err) {
        handleError(err, 'Не удалось начать сессию')
        throw err
      } finally {
        setPendingAction(false)
      }
    },
    [selectedPatientId, activeSession, refreshSessions, handleError],
  )

  const endSession = useCallback(
    async (status: Exclude<SessionStatus, 'active'> = 'completed') => {
      if (!activeSession) {
        throw new Error('Нет активной сессии')
      }
      setPendingAction(true)
      setError(null)
      try {
        const updated = await sessionsApi.updateSession(activeSession.id, {
          ended_at: new Date().toISOString(),
          status,
        })
        await refreshSessions()
        return updated
      } catch (err) {
        handleError(err, 'Не удалось завершить сессию')
        throw err
      } finally {
        setPendingAction(false)
      }
    },
    [activeSession, refreshSessions, handleError],
  )

  const clearError = useCallback(() => setError(null), [])

  return useMemo(
    () => ({
      patients,
      selectedPatient,
      selectedPatientId,
      sessions,
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
      clearError,
    }),
    [
      patients,
      selectedPatient,
      selectedPatientId,
      sessions,
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
      clearError,
    ],
  )
}