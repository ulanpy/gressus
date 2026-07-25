import { useI18n } from '@/i18n/context'
import type { ControlPageProps } from '@/types/components'
import type { PatientSessionWorkflow } from '@/hooks/usePatientSessionWorkflow'
import type { PatientWorkspaceView } from '@/widgets/patients/PatientViewMenu'
import { PatientCreateAction } from '@/widgets/patients/PatientCreateAction'
import { PatientSelector } from '@/widgets/patients/PatientSelector'
import { PatientWorkspace } from '@/widgets/patients/PatientWorkspace'

type ControlPhase = 'patient' | 'session' | 'runtime'

function getPhase(workflow: PatientSessionWorkflow): ControlPhase {
  if (!workflow.selectedPatient) return 'patient'
  if (!workflow.activeSession) return 'session'
  return 'runtime'
}

type ControlPageFullProps = ControlPageProps & {
  workspaceView: PatientWorkspaceView
  onWorkspaceViewChange: (view: PatientWorkspaceView) => void
}

export function ControlPage({
  workflow,
  workspaceView,
  onWorkspaceViewChange,
}: ControlPageFullProps) {
  const { t } = useI18n()
  const phase = getPhase(workflow)

  return (
    <div className="grid gap-5">
      {phase === 'patient' ? (
        <>
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="page-title text-[24px]">{t.control.title}</h1>
              <p className="page-subtitle">{t.control.setupHint}</p>
            </div>
            <PatientCreateAction workflow={workflow} />
          </header>
          <PatientSelector
            workflow={workflow}
            onPatientChosen={() => onWorkspaceViewChange('sessions')}
          />
        </>
      ) : (
        <PatientWorkspace
          workflow={workflow}
          workspaceView={workspaceView}
          onWorkspaceViewChange={onWorkspaceViewChange}
          showActiveSession
        />
      )}
    </div>
  )
}
