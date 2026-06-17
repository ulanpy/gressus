import { useCallback } from 'react'
import { useI18n } from '../i18n/context'
import type { ControlPageProps } from '../types/components'
import type { GameLaunchParams } from '../types/runtime'
import type { PatientSessionWorkflow } from '../hooks/usePatientSessionWorkflow'
import { PatientSelector } from '../components/patients/PatientSelector'
import { SessionPanel } from '../components/sessions/SessionPanel'
import { RuntimeControls } from '../components/runtime/RuntimeControls'
import { cn } from '../lib/cn'
import { container, panel, workflowBtnDanger } from '../styles/ui'

type ControlPhase = 'patient' | 'session' | 'runtime'

function getPhase(workflow: PatientSessionWorkflow): ControlPhase {
  if (!workflow.selectedPatient) return 'patient'
  if (!workflow.activeSession) return 'session'
  return 'runtime'
}

function ControlContextBar({ workflow }: { workflow: PatientSessionWorkflow }) {
  const { t } = useI18n()

  if (!workflow.selectedPatient) return null

  return (
    <div
      className={cn(
        panel,
        'relative z-0 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3',
      )}
    >
      <div className="min-w-0">
        <p className="m-0 text-sm font-semibold text-text-strong truncate">
          {workflow.selectedPatient.display_name}
        </p>
        {workflow.activeSession && (
          <p className="m-0 mt-0.5 text-xs text-muted">
            {t.workflow.sessionNumber(workflow.activeSession.session_number)} ·{' '}
            {t.workflow.statusActive}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PatientSelector workflow={workflow} variant="inline" />
        {workflow.activeSession && (
          <button
            type="button"
            className={workflowBtnDanger}
            onClick={() => void workflow.endSession('completed')}
            disabled={workflow.pendingAction}
          >
            {t.workflow.endSession}
          </button>
        )}
      </div>
    </div>
  )
}

export function ControlPage({
  workflow,
  runtime,
  runtimeActionError,
  runtimePending,
  startCalibration,
  startGame,
  stopRuntime,
}: ControlPageProps) {
  const { t } = useI18n()
  const phase = getPhase(workflow)

  const handleStartGame = useCallback(
    async (params: GameLaunchParams) => {
      if (workflow.activeSession) {
        await workflow.updateActiveSessionLaunchConfig({ ...params, job: 'game' })
      }
      await startGame(params)
    },
    [workflow, startGame],
  )

  const handleStartCalibration = useCallback(
    async (params: Pick<GameLaunchParams, 'outputRotation'>) => {
      if (workflow.activeSession) {
        await workflow.updateActiveSessionLaunchConfig({
          job: 'calibrate_apriltag',
          outputRotation: params.outputRotation,
        })
      }
      await startCalibration(params)
    },
    [workflow, startCalibration],
  )

  return (
    <div className={cn(container, 'grid gap-5')}>
      <header>
        <h1 className="m-0 text-2xl font-bold tracking-[-0.02em] text-text-strong">
          {t.control.title}
        </h1>
        {phase === 'patient' && (
          <p className="mt-2 mb-0 text-sm text-muted">{t.control.setupHint}</p>
        )}
      </header>

      {phase !== 'patient' && <ControlContextBar workflow={workflow} />}

      {phase === 'patient' && <PatientSelector workflow={workflow} />}

      {phase === 'session' && <SessionPanel workflow={workflow} />}

      {phase === 'runtime' && (
        <RuntimeControls
          runtime={runtime}
          actionError={runtimeActionError ?? workflow.error}
          pending={runtimePending || workflow.pendingAction}
          disabled={!workflow.canUseRuntime}
          startCalibration={handleStartCalibration}
          startGame={handleStartGame}
          stopRuntime={stopRuntime}
        />
      )}
    </div>
  )
}
