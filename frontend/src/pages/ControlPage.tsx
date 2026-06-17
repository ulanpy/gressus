import { useCallback } from 'react'
import { useI18n } from '../i18n/context'
import type { ControlPageProps } from '../types/components'
import type { GameLaunchParams } from '../types/runtime'
import { PatientSelector } from '../components/patients/PatientSelector'
import { SessionPanel } from '../components/sessions/SessionPanel'
import { RuntimeControls } from '../components/runtime/RuntimeControls'


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
    <>
      <section className="hero hero--compact">
        <div>
          <p className="eyebrow">{t.control.eyebrow}</p>
          <h1>{t.control.title}</h1>
          <p className="lede">{t.control.lede}</p>
        </div>
      </section>

      <div className="workflow-layout">
        <PatientSelector workflow={workflow} />
        <SessionPanel workflow={workflow} />

        <section className="workflow-step workflow-step--runtime" aria-label={t.workflow.stepRuntime}>
          <header className="workflow-step__head">
            <p className="eyebrow">{t.workflow.stepRuntime}</p>
            <h2>{t.control.runtimeAria}</h2>
          </header>

          {!workflow.canUseRuntime && (
            <p className="workflow-muted workflow-runtime-lock">{t.workflow.runtimeLocked}</p>
          )}

          <RuntimeControls
            runtime={runtime}
            actionError={runtimeActionError ?? workflow.error}
            pending={runtimePending || workflow.pendingAction}
            disabled={!workflow.canUseRuntime}
            startCalibration={handleStartCalibration}
            startGame={handleStartGame}
            stopRuntime={stopRuntime}
          />
        </section>
      </div>
    </>
  )
}
