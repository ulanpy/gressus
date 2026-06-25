import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/context'
import type { ControlPageProps } from '../types/components'
import type { PatientSessionWorkflow } from '../hooks/usePatientSessionWorkflow'
import { AssessmentSection } from '../components/assessments/AssessmentSection'
import { PatientCreateAction } from '../components/patients/PatientCreateAction'
import { PatientCard } from '../components/patients/PatientCard'
import { PatientProfileActions } from '../components/patients/PatientProfileActions'
import { PatientSelector } from '../components/patients/PatientSelector'
import { PatientSwitch } from '../components/patients/PatientSwitch'
import {
  PatientViewMenu,
  type PatientWorkspaceView,
} from '../components/patients/PatientViewMenu'
import { SessionHistoryList } from '../components/sessions/SessionHistoryList'
import { cn } from '../lib/cn'
import { container, panel } from '../styles/ui'

type ControlPhase = 'patient' | 'session' | 'runtime'

function getPhase(workflow: PatientSessionWorkflow): ControlPhase {
  if (!workflow.selectedPatient) return 'patient'
  if (!workflow.activeSession) return 'session'
  return 'runtime'
}

function ControlContextBar({ workflow }: { workflow: PatientSessionWorkflow }) {
  const { t } = useI18n()
  const [workspaceView, setWorkspaceView] = useState<PatientWorkspaceView>('profile')

  useEffect(() => {
    setWorkspaceView('profile')
  }, [workflow.selectedPatientId])

  if (!workflow.selectedPatient) return null

  return (
    <div className={cn(panel, 'relative z-0 w-full rounded-2xl px-5 py-4')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 min-w-0 truncate text-xl font-bold tracking-[-0.02em] text-text-strong">
          {workflow.selectedPatient.display_name}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <PatientProfileActions workflow={workflow} />
        </div>
      </div>

      {workflow.activeSession && (
        <p className="m-0 mt-3 text-sm font-semibold text-brand">
          {t.workflow.sessionNumber(workflow.activeSession.session_number ?? 0)} ·{' '}
          {t.workflow.statusActive}
        </p>
      )}

      <PatientViewMenu
        className="mt-3"
        value={workspaceView}
        onChange={setWorkspaceView}
        disabled={workflow.pendingAction}
      />

      <div className="w-full">
        {workspaceView === 'profile' && <PatientCard patient={workflow.selectedPatient} />}

        {workspaceView === 'sessions' && (
          <SessionHistoryList
            sessions={workflow.sessions}
            activeSessionId={workflow.activeSession?.id ?? null}
          />
        )}

        {workspaceView === 'assessments' && (
          <AssessmentSection workflow={workflow} embedded />
        )}
      </div>
    </div>
  )
}

export function ControlPage({
  workflow,
}: ControlPageProps) {
  const { t } = useI18n()
  const phase = getPhase(workflow)

  return (
    <div className={cn(container, 'grid gap-5')}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold tracking-[-0.02em] text-text-strong">
            {t.control.title}
          </h1>
          {phase === 'patient' && (
            <p className="mt-2 mb-0 text-sm text-muted">{t.control.setupHint}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <PatientSwitch workflow={workflow} menuAlign="right" />
          <PatientCreateAction workflow={workflow} />
        </div>
      </header>

      {phase !== 'patient' && <ControlContextBar workflow={workflow} />}

      {phase === 'patient' && <PatientSelector workflow={workflow} />}

      {/* {phase === 'runtime' && (
        <RuntimeControls
          runtime={runtime}
          actionError={runtimeActionError ?? workflow.error}
          pending={runtimePending || workflow.pendingAction}
          disabled={!workflow.canUseRuntime}
          startCalibration={handleStartCalibration}
          startGame={handleStartGame}
          stopRuntime={stopRuntime}
        />
      )} */}
    </div>
  )
}
