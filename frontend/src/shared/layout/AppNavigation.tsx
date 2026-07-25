import { useState, type ReactNode } from 'react'
import {
  ArrowLeftRight,
  ClipboardList,
  FilePlus,
  History,
  PersonStanding,
  Plus,
  Shield,
  UserPlus,
  Users,
} from 'lucide-react'
import { useI18n } from '@/i18n/context'
import type { PatientSessionWorkflow } from '@/hooks/usePatientSessionWorkflow'
import type { ViewMode } from '@/types/navigation'
import type { PatientCreate } from '@/types/patients'
import type { PatientWorkspaceView } from '@/widgets/patients/PatientViewMenu'
import { cn } from '@/shared/lib/utils'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/shared/ui/navigation-menu'
import { AssessmentModal } from '@/widgets/assessments/AssessmentModal'
import { PatientForm } from '@/widgets/patients/PatientForm'
import { PatientPickModal } from '@/widgets/patients/PatientPickModal'

type AppNavigationProps = {
  activeView: ViewMode
  setActiveView: (view: ViewMode) => void
  workflow: PatientSessionWorkflow
  workspaceView: PatientWorkspaceView
  onWorkspaceViewChange: (view: PatientWorkspaceView) => void
}

type PatientScopedAction = 'session' | 'assessment'
type PendingSection = PatientWorkspaceView

function NavAction({
  title,
  description,
  icon,
  disabled,
  onSelect,
  className,
}: {
  title: string
  description: string
  icon: ReactNode
  disabled?: boolean
  onSelect: () => void
  className?: string
}) {
  return (
    <li>
      <NavigationMenuLink
        asChild
        className={cn(
          'flex-row items-start gap-3 rounded-xl p-3',
          disabled && 'pointer-events-none opacity-45',
          className,
        )}
      >
        <button type="button" disabled={disabled} onClick={onSelect}>
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            {icon}
          </span>
          <span className="min-w-0 text-left">
            <span className="block text-sm font-semibold text-slate-900">{title}</span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
              {description}
            </span>
          </span>
        </button>
      </NavigationMenuLink>
    </li>
  )
}

function ViewLink({
  active,
  onSelect,
  children,
  className,
}: {
  active?: boolean
  onSelect: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-active={active ? 'true' : undefined}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-transparent px-3.5 text-sm font-medium shadow-none outline-none transition-colors',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50',
        active
          ? 'bg-sky-50 text-sky-700 hover:bg-sky-50 hover:text-sky-700'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
        className,
      )}
    >
      {children}
    </button>
  )
}

const navTriggerClass = cn(
  'h-10 gap-2 rounded-xl bg-transparent px-3.5 text-sm font-medium shadow-none',
  'hover:bg-slate-50 hover:text-slate-800 data-[state=open]:bg-slate-50 data-[state=open]:text-slate-800',
)

export function AppNavigation({
  activeView,
  setActiveView,
  workflow,
  workspaceView,
  onWorkspaceViewChange,
}: AppNavigationProps) {
  const { t } = useI18n()
  const [createOpen, setCreateOpen] = useState(false)
  const [assessmentOpen, setAssessmentOpen] = useState(false)
  const [pickAction, setPickAction] = useState<PatientScopedAction | null>(null)
  const [pickSection, setPickSection] = useState<PendingSection | null>(null)

  const disabled = workflow.pendingAction || workflow.patientLocked
  const noPatients = workflow.patients.length === 0
  const patient = workflow.selectedPatient

  const goControl = () => setActiveView('control')

  const goPatientList = () => {
    setActiveView('control')
    if (!workflow.patientLocked) {
      workflow.selectPatient(null)
    }
  }

  const openSection = (section: PatientWorkspaceView) => {
    setActiveView('control')
    if (patient) {
      onWorkspaceViewChange(section)
      return
    }
    setPickSection(section)
  }

  const handleCreateSubmit = async (data: PatientCreate) => {
    await workflow.createPatient(data)
    setCreateOpen(false)
    setActiveView('control')
    onWorkspaceViewChange('profile')
  }

  const handleActionPatientPicked = async (patientId: string) => {
    const action = pickAction
    if (!action) return

    if (action === 'session') {
      setPickAction(null)
      setActiveView('control')
      onWorkspaceViewChange('sessions')
      await workflow.startSession({}, patientId)
      return
    }

    workflow.selectPatient(patientId)
    setPickAction(null)
    setActiveView('control')
    onWorkspaceViewChange('assessments')
    setAssessmentOpen(true)
  }

  const handleSectionPatientPicked = (patientId: string) => {
    const section = pickSection
    if (!section) return
    workflow.selectPatient(patientId)
    setPickSection(null)
    setActiveView('control')
    onWorkspaceViewChange(section)
  }

  return (
    <>
      <NavigationMenu
        viewport={false}
        className="relative z-50 max-w-none justify-start"
      >
        <NavigationMenuList className="flex-wrap items-center justify-start gap-1 rounded-2xl border border-border bg-white p-1 shadow-panel">
          <NavigationMenuItem>
            <ViewLink
              active={activeView === 'therapist'}
              onSelect={() => setActiveView('therapist')}
            >
              <PersonStanding className="size-4" />
              {t.tabs.therapist}
            </ViewLink>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuTrigger
              className={cn(
                navTriggerClass,
                activeView === 'control' &&
                  'bg-sky-50 text-sky-700 hover:bg-sky-50 focus:bg-sky-50 data-[state=open]:bg-sky-50 data-[state=open]:text-sky-700',
              )}
              onClick={goControl}
            >
              <Users className="size-4" />
              {t.tabs.control}
            </NavigationMenuTrigger>
            <NavigationMenuContent className="z-50 min-w-[320px] rounded-2xl border border-border bg-white p-2 shadow-panel">
              <ul className="grid gap-1">
                {patient ? (
                  <>
                    <li className="px-3 py-2">
                      <p className="m-0 text-[11px] font-semibold tracking-[0.08em] text-slate-400 uppercase">
                        {t.nav.pinnedPatient}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                          {patient.display_name}
                        </p>
                        <button
                          type="button"
                          disabled={workflow.patientLocked}
                          title={t.nav.switchPatient}
                          aria-label={t.nav.switchPatient}
                          onClick={goPatientList}
                          className={cn(
                            'inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors',
                            'hover:bg-slate-100 hover:text-slate-800',
                            'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                            'disabled:pointer-events-none disabled:opacity-45',
                          )}
                        >
                          <ArrowLeftRight className="size-4" />
                        </button>
                      </div>
                    </li>
                    <NavAction
                      title={t.workflow.patientViewProfile}
                      description={t.nav.sectionProfileDesc}
                      icon={<ClipboardList className="size-4" />}
                      onSelect={() => openSection('profile')}
                      className={
                        activeView === 'control' && workspaceView === 'profile'
                          ? 'bg-sky-50'
                          : undefined
                      }
                    />
                    <NavAction
                      title={t.workflow.patientViewSessions}
                      description={t.nav.sectionSessionsDesc}
                      icon={<History className="size-4" />}
                      onSelect={() => openSection('sessions')}
                      className={
                        activeView === 'control' && workspaceView === 'sessions'
                          ? 'bg-sky-50'
                          : undefined
                      }
                    />
                    <NavAction
                      title={t.workflow.patientViewAssessments}
                      description={t.nav.sectionAssessmentsDesc}
                      icon={<FilePlus className="size-4" />}
                      onSelect={() => openSection('assessments')}
                      className={
                        activeView === 'control' && workspaceView === 'assessments'
                          ? 'bg-sky-50'
                          : undefined
                      }
                    />
                    <li className="my-1 border-t border-border" />
                  </>
                ) : (
                  <NavAction
                    title={t.nav.selectPatient}
                    description={t.nav.selectPatientDesc}
                    icon={<Users className="size-4" />}
                    onSelect={goPatientList}
                  />
                )}
                <NavAction
                  title={t.workflow.createPatient}
                  description={t.nav.createPatientDesc}
                  icon={<UserPlus className="size-4" />}
                  disabled={disabled}
                  onSelect={() => {
                    if (!workflow.patientLocked) {
                      workflow.selectPatient(null)
                    }
                    setActiveView('control')
                    setCreateOpen(true)
                  }}
                />
                <NavAction
                  title={t.workflow.newSession}
                  description={t.nav.newSessionDesc}
                  icon={<Plus className="size-4" />}
                  disabled={disabled || noPatients}
                  onSelect={() => setPickAction('session')}
                />
                <NavAction
                  title={t.assessment.create}
                  description={t.nav.newAssessmentDesc}
                  icon={<FilePlus className="size-4" />}
                  disabled={disabled || noPatients}
                  onSelect={() => setPickAction('assessment')}
                />
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <ViewLink
              active={activeView === 'exoskeleton'}
              onSelect={() => setActiveView('exoskeleton')}
            >
              <Shield className="size-4" />
              {t.tabs.exoskeleton}
            </ViewLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>

      <PatientForm
        open={createOpen}
        mode="create"
        initial={null}
        pending={workflow.pendingAction}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateSubmit}
      />
      <PatientPickModal
        open={pickAction != null}
        patients={workflow.patients}
        title={t.workflow.selectPatient}
        description={
          pickAction === 'assessment'
            ? t.nav.pickPatientForAssessment
            : t.nav.pickPatientForSession
        }
        confirmLabel={t.nav.pickPatientConfirm}
        pending={workflow.pendingAction}
        initialPatientId={null}
        onConfirm={handleActionPatientPicked}
        onClose={() => setPickAction(null)}
      />
      <PatientPickModal
        open={pickSection != null}
        patients={workflow.patients}
        title={t.workflow.selectPatient}
        description={t.nav.pickPatientForSection}
        confirmLabel={t.nav.pickPatientConfirm}
        pending={workflow.pendingAction}
        initialPatientId={null}
        onConfirm={handleSectionPatientPicked}
        onClose={() => setPickSection(null)}
      />
      <AssessmentModal
        open={assessmentOpen}
        mode="create"
        assessment={null}
        pending={workflow.pendingAction}
        workflow={workflow}
        onClose={() => setAssessmentOpen(false)}
        onSaved={() => void workflow.refreshAssessments()}
      />
    </>
  )
}
