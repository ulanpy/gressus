import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useI18n } from '@/i18n/context'
import type { PatientSessionWorkflow } from '@/hooks/usePatientSessionWorkflow'
import { AssessmentSection } from '@/widgets/assessments/AssessmentSection'
import {
  SessionHistoryDrawer,
  useSelectedSessionId,
} from '@/widgets/sessions/SessionHistoryDrawer'
import { SessionsAnalyticsPanel } from '@/widgets/sessions/SessionsAnalyticsPanel'
import { cn } from '@/shared/lib/utils'
import { Card, CardContent } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { PatientHeader } from './PatientHeader'
import { PatientProfilePanel } from './PatientProfilePanel'
import { PatientSidebar } from './PatientSidebar'
import { PatientViewMenu, type PatientWorkspaceView } from './PatientViewMenu'

type PatientWorkspaceProps = {
  workflow: PatientSessionWorkflow
  workspaceView: PatientWorkspaceView
  onWorkspaceViewChange: (view: PatientWorkspaceView) => void
  showActiveSession?: boolean
  embedded?: boolean
  className?: string
}

function TabPanel({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'col-start-1 row-start-1',
        !active && 'invisible pointer-events-none',
      )}
      aria-hidden={!active}
      // Keep inactive panels in layout so tab switches don't change card height.
      inert={!active || undefined}
    >
      {children}
    </div>
  )
}

export function PatientWorkspace({
  workflow,
  workspaceView,
  onWorkspaceViewChange,
  showActiveSession = false,
  embedded = false,
  className,
}: PatientWorkspaceProps) {
  const { t } = useI18n()
  const patient = workflow.selectedPatient
  const [selectedSessionId, setSelectedSessionId] = useSelectedSessionId(
    workflow.sessions,
    workflow.activeSession?.id ?? null,
    workflow.selectedPatientId,
  )

  if (!patient) return null

  const content = (
    <div
      className={cn(
        'grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_280px]',
        className,
      )}
    >
      <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-panel">
        <PatientHeader
          patient={patient}
          workflow={workflow}
          showActiveSession={showActiveSession}
        />

        <CardContent className="px-5 pt-3 pb-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <PatientViewMenu
              value={workspaceView}
              onChange={onWorkspaceViewChange}
              disabled={workflow.pendingAction}
            />
            <div
              className={cn(
                workspaceView !== 'sessions' && 'invisible pointer-events-none',
              )}
              aria-hidden={workspaceView !== 'sessions'}
              inert={workspaceView !== 'sessions' || undefined}
            >
              <SessionHistoryDrawer
                patientId={patient.id}
                sessions={workflow.sessions}
                activeSessionId={workflow.activeSession?.id ?? null}
                selectedSessionId={selectedSessionId}
                onSelectSession={setSelectedSessionId}
              />
            </div>
          </div>

          <div className="grid">
            <TabPanel active={workspaceView === 'profile'}>
              <PatientProfilePanel patient={patient} />
            </TabPanel>

            <TabPanel active={workspaceView === 'sessions'}>
              <SessionsAnalyticsPanel
                sessions={workflow.sessions}
                selectedSessionId={selectedSessionId}
                onSessionUpdated={() => void workflow.refreshSessions()}
              />
            </TabPanel>

            <TabPanel active={workspaceView === 'assessments'}>
              <AssessmentSection workflow={workflow} embedded />
            </TabPanel>
          </div>
        </CardContent>
      </Card>

      <PatientSidebar
        patient={patient}
        className="max-lg:hidden lg:sticky lg:top-4 lg:self-start"
      />
    </div>
  )

  if (embedded) return <div className="mt-4">{content}</div>

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="mb-3 size-9 rounded-full bg-white shadow-panel sm:absolute sm:top-12 sm:-left-12 sm:mb-0"
        title={t.workflow.switchPatient}
        aria-label={t.workflow.switchPatient}
        onClick={() => workflow.selectPatient(null)}
      >
        <ArrowLeft className="size-4" />
      </Button>
      {content}
    </div>
  )
}
