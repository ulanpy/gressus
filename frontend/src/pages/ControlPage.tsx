import { useCallback, useState } from 'react'
import { useI18n } from '../i18n/context'
import type { ControlPageProps } from '../types/components'
import type { GameLaunchParams } from '../types/runtime'
import type { PatientSessionWorkflow } from '../hooks/usePatientSessionWorkflow'
import { PatientCreateAction } from '../components/patients/PatientCreateAction'
import { PatientDemographics } from '../components/patients/PatientDemographics'
import { PatientProfileActions } from '../components/patients/PatientProfileActions'
import { PatientSelector } from '../components/patients/PatientSelector'
import { PatientSwitch } from '../components/patients/PatientSwitch'
import { SessionHistoryList } from '../components/sessions/SessionHistoryList'
import { SessionStartModal } from '../components/sessions/SessionStartModal'
import { RuntimeControls } from '../components/runtime/RuntimeControls'
import { IconButton, PlayIcon, StopIcon } from '../components/ui/IconButton'
import { cn } from '../lib/cn'
import { container, panel, sessionHistoryBlock } from '../styles/ui'

type ControlPhase = 'patient' | 'session' | 'runtime'

function getPhase(workflow: PatientSessionWorkflow): ControlPhase {
  if (!workflow.selectedPatient) return 'patient'
  if (!workflow.activeSession) return 'session'
  return 'runtime'
}

function ControlContextBar({ workflow }: { workflow: PatientSessionWorkflow }) {
  const { t } = useI18n()
  const [startOpen, setStartOpen] = useState(false)
  const showHistory = !workflow.activeSession

  if (!workflow.selectedPatient) return null

  const handleStartSession = async (notes: string | null) => {
    await workflow.startSession(notes)
  }

  return (
    <>
      <div className={cn(panel, 'relative z-0 rounded-2xl px-4 py-3')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="m-0 min-w-0 truncate text-lg font-bold tracking-[-0.02em] text-text-strong">
                {workflow.selectedPatient.display_name}
              </h2>
              <PatientSwitch workflow={workflow} menuAlign="left" compact />
            </div>
            <PatientDemographics patient={workflow.selectedPatient} />
            {workflow.activeSession && (
              <p className="m-0 mt-1.5 text-xs font-semibold text-brand">
                {t.workflow.sessionNumber(workflow.activeSession.session_number)} ·{' '}
                {t.workflow.statusActive}
              </p>
            )}
          </div>

          <PatientProfileActions workflow={workflow}>
            {!workflow.activeSession ? (
              <IconButton
                label={t.workflow.startSession}
                variant="primary"
                onClick={() => setStartOpen(true)}
                disabled={workflow.pendingAction}
              >
                <PlayIcon />
              </IconButton>
            ) : (
              <IconButton
                label={t.workflow.endSession}
                variant="danger"
                onClick={() => void workflow.endSession('completed')}
                disabled={workflow.pendingAction}
              >
                <StopIcon />
              </IconButton>
            )}
          </PatientProfileActions>
        </div>

        {showHistory && (
          <div className={cn(sessionHistoryBlock, 'mt-4 border-t border-panel-border pt-4')}>
            <h3 className="m-0 mb-0 text-sm font-bold text-text-strong">
              {t.workflow.sessionHistory}
            </h3>
            <SessionHistoryList
              sessions={workflow.sessions}
              activeSessionId={workflow.activeSession?.id ?? null}
            />
          </div>
        )}
      </div>

      <SessionStartModal
        open={startOpen}
        pending={workflow.pendingAction}
        onClose={() => setStartOpen(false)}
        onStart={handleStartSession}
      />
    </>
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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold tracking-[-0.02em] text-text-strong">
            {t.control.title}
          </h1>
          {phase === 'patient' && (
            <p className="mt-2 mb-0 text-sm text-muted">{t.control.setupHint}</p>
          )}
        </div>
        <PatientCreateAction workflow={workflow} />
      </header>

      {phase !== 'patient' && <ControlContextBar workflow={workflow} />}

      {phase === 'patient' && <PatientSelector workflow={workflow} />}

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
