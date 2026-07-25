import { useCallback, useEffect, useState } from 'react'
import type { ExoskeletonControlFlags } from '@/hooks/useExoskeletonTelemetry'
import { listPatients } from '@/lib/api/patients'
import type { GaitProfile } from '@/lib/exoskeleton/profileForm'
import {
  startRecordingSession,
  stopRecordingSession,
  type SessionActionResponse,
} from '@/lib/api/runtime'
import type { Patient } from '@/types/patients'
import type { SessionAnthropometrics } from '@/types/sessions'
import { ExoskeletonProfileDialog } from '@/widgets/exoskeleton/ExoskeletonProfileDialog'
import {
  ExoskeletonTelemetryPanel,
  type ExoskeletonProgressStep,
  type ExoskeletonSessionState,
} from '@/widgets/exoskeleton/ExoskeletonTelemetryPanel'
import {
  ExoskeletonWorkflowBar,
  type ExoskeletonWorkflowState,
} from '@/widgets/exoskeleton/ExoskeletonWorkflowBar'
import type { ExoskeletonIconName } from '@/widgets/exoskeleton/ExoskeletonIcon'

type ProgressStepId =
  | 'arm'
  | 'profile'
  | 'configuration'
  | 'baseline'
  | 'gait'
  | 'running'
  | 'stopped'

type ProgressStep = ExoskeletonProgressStep & { id: ProgressStepId }
type StepStatus = ProgressStep['status']

const initialProgress: ProgressStep[] = [
  { id: 'arm', label: 'Arm complete', status: 'idle' },
  { id: 'profile', label: 'Profile loaded', status: 'idle' },
  { id: 'configuration', label: 'Configuration checked', status: 'idle' },
  { id: 'baseline', label: 'Baseline calibrated', status: 'idle' },
  { id: 'gait', label: 'Recording started', status: 'idle' },
  { id: 'running', label: 'Session running', status: 'idle' },
  { id: 'stopped', label: 'Session stopped', status: 'idle' },
]

function setStep(steps: ProgressStep[], id: ProgressStepId, status: StepStatus, detail?: string) {
  return steps.map((step) => (step.id === id ? { ...step, status, detail } : step))
}

export function ExoskeletonControlPanel() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [profileDialogMode, setProfileDialogMode] = useState<'edit' | 'start'>('start')
  const [activePatient, setActivePatient] = useState<Patient | null>(null)
  const [activeProfile, setActiveProfile] = useState<GaitProfile | null>(null)
  const [progress, setProgress] = useState<ProgressStep[]>(initialProgress)
  const [sessionState, setSessionState] = useState<ExoskeletonSessionState>('Idle')
  const [busy, setBusy] = useState(false)
  const [, setLastResponse] = useState<SessionActionResponse | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [telemetryFlags, setTelemetryFlags] = useState<ExoskeletonControlFlags>({
    estop: false,
    running: false,
    error: null,
  })

  const onTelemetryFlagsChange = useCallback((flags: ExoskeletonControlFlags) => {
    setTelemetryFlags((prev) =>
      prev.estop === flags.estop && prev.running === flags.running && prev.error === flags.error
        ? prev
        : flags,
    )
  }, [])

  useEffect(() => {
    setPatientsLoading(true)
    listPatients()
      .then(setPatients)
      .catch(() => setPatients([]))
      .finally(() => setPatientsLoading(false))
  }, [])

  const runSessionAction = async (
    action: 'start' | 'stop',
    body?: {
      patientId: string
      profileJson?: string
      anthropometrics?: SessionAnthropometrics
    },
  ) => {
    const response =
      action === 'start'
        ? await startRecordingSession(body!)
        : await stopRecordingSession()
    setLastResponse(response)
    return response
  }

  const updateStep = (id: ProgressStepId, status: StepStatus, detail?: string) => {
    setProgress((prev) => setStep(prev, id, status, detail))
  }

  const openStartDialog = () => {
    setProfileDialogMode('start')
    setProfileDialogOpen(true)
  }

  const openEditProfileDialog = () => {
    if (!activePatient) return
    setProfileDialogMode('edit')
    setProfileDialogOpen(true)
  }

  const startSession = async (
    patient: Patient,
    profile: GaitProfile,
    anthropometrics?: SessionAnthropometrics,
  ) => {
    setProfileDialogOpen(false)
    setBusy(true)
    setLastError(null)
    setLastResponse(null)
    setActivePatient(patient)
    setActiveProfile(profile)
    setSessionState('Arming')
    let currentStep: ProgressStepId = 'arm'

    try {
      currentStep = 'arm'
      updateStep('arm', 'running', 'Arming device...')
      updateStep('arm', 'success', 'Device armed')

      currentStep = 'profile'
      updateStep('profile', 'running', 'Loading profile...')
      updateStep('profile', 'success', 'Profile recorded')

      currentStep = 'configuration'
      updateStep('configuration', 'running', 'Preparing recording...')
      updateStep('configuration', 'success', 'Recording ready')

      currentStep = 'gait'
      updateStep('gait', 'running', 'Starting session recording...')
      await runSessionAction('start', {
        patientId: patient.id,
        profileJson: profile.profileJson,
        anthropometrics,
      })
      updateStep('gait', 'success', 'Recording started')
      setSessionState('Running')

      updateStep('baseline', 'success', 'Baseline skipped')
      updateStep('running', 'success', 'Session recording')
    } catch (err) {
      updateStep(currentStep, 'error')
      setSessionState('Error')
      setLastError(err instanceof Error ? err.message : 'Session start failed')
    } finally {
      setBusy(false)
    }
  }

  const updateActiveProfile = async (patient: Patient, profile: GaitProfile) => {
    setProfileDialogOpen(false)
    setBusy(true)
    setLastError(null)
    setLastResponse(null)
    const wasRunning = sessionState === 'Running'

    try {
      updateStep('profile', 'success', 'Profile updated')
      setActivePatient(patient)
      setActiveProfile(profile)
      setSessionState((current) => {
        if (wasRunning) return 'Running'
        return current === 'Loading Profile' ? 'Ready' : current
      })
    } catch (err) {
      updateStep('profile', 'error')
      setSessionState('Error')
      setLastError(err instanceof Error ? err.message : 'Profile update failed')
    } finally {
      setBusy(false)
    }
  }

  const stopSession = async () => {
    setBusy(true)
    setLastError(null)
    setLastResponse(null)

    try {
      updateStep('stopped', 'running', 'Stopping session...')
      await runSessionAction('stop')
      updateStep('stopped', 'success', 'Session stopped')
      setSessionState('Idle')
      setActivePatient(null)
      setActiveProfile(null)
    } catch (err) {
      updateStep('stopped', 'error')
      setSessionState('Error')
      setLastError(err instanceof Error ? err.message : 'Stop session failed')
    } finally {
      setBusy(false)
    }
  }

  const acknowledgeEstop = () => {
    setLastError(null)
    setSessionState('Idle')
    setActivePatient(null)
    setActiveProfile(null)
    setProgress(initialProgress)
  }

  const workflowState: ExoskeletonWorkflowState = telemetryFlags.estop
    ? 'estop'
    : lastError || sessionState === 'Error'
      ? 'error'
      : sessionState === 'Running' || telemetryFlags.running
        ? 'running'
        : 'initial'
  const retryTitle = lastError?.toLowerCase().includes('connected') ? 'Resolve Error' : 'Retry'
  const primaryAction: {
    icon: ExoskeletonIconName
    title: string
    subtitle: string
    onClick: () => void
    variant: 'danger' | 'primary'
  } =
    workflowState === 'estop'
      ? {
          icon: 'refresh',
          title: 'Reset E-STOP',
          subtitle: 'Clear emergency stop',
          onClick: acknowledgeEstop,
          variant: 'danger',
        }
      : workflowState === 'error'
        ? {
            icon: 'refresh',
            title: retryTitle,
            subtitle:
              retryTitle === 'Resolve Error'
                ? 'Check device connection, then retry'
                : 'Start the session again',
            onClick: openStartDialog,
            variant: 'primary',
          }
        : workflowState === 'running'
          ? {
              icon: 'stop',
              title: 'Stop Session',
              subtitle: 'Stop recording',
              onClick: () => void stopSession(),
              variant: 'danger',
            }
          : {
              icon: 'play',
              title: 'Start Session',
              subtitle: 'Select patient and start recording',
              onClick: openStartDialog,
              variant: 'primary',
            }

  const showSessionContext = workflowState === 'running' || workflowState === 'error'
  const patientLabel = activePatient?.display_name ?? 'No patient'
  const statusLabel = workflowState === 'running' ? 'Recording' : 'Error'

  return (
    <div className="mx-auto grid w-full max-w-[1540px] gap-5 text-[#17213b]">
      <ExoskeletonWorkflowBar
        workflowState={workflowState}
        lastError={lastError}
        busy={busy}
        showSessionContext={showSessionContext}
        patientLabel={patientLabel}
        statusLabel={statusLabel}
        activeProfile={activeProfile}
        primaryAction={primaryAction}
        onEditProfile={openEditProfileDialog}
      />

      <ExoskeletonTelemetryPanel
        onFlagsChange={onTelemetryFlagsChange}
        progress={progress}
        sessionState={sessionState}
      />

      <ExoskeletonProfileDialog
        open={profileDialogOpen}
        confirmLabel={profileDialogMode === 'edit' ? 'Обновить профиль' : 'Подтвердить и загрузить'}
        includeAnthropometrics={profileDialogMode === 'start'}
        initialPatientId={profileDialogMode === 'edit' ? activePatient?.id : null}
        initialProfile={profileDialogMode === 'edit' ? activeProfile : null}
        loading={patientsLoading || busy}
        patients={patients}
        onClose={() => setProfileDialogOpen(false)}
        onConfirm={(patient, profile, anthropometrics) =>
          void (profileDialogMode === 'edit'
            ? updateActiveProfile(patient, profile)
            : startSession(patient, profile, anthropometrics))
        }
        title={profileDialogMode === 'edit' ? 'Редактировать профиль' : 'Начать сессию'}
      />
    </div>
  )
}
