import { useI18n } from '@/i18n/context'
import { cn } from '@/shared/lib/utils'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'

export type PatientWorkspaceView = 'profile' | 'sessions' | 'assessments'

type PatientViewMenuProps = {
  value: PatientWorkspaceView
  onChange: (view: PatientWorkspaceView) => void
  disabled?: boolean
  className?: string
}

const VIEWS: PatientWorkspaceView[] = ['profile', 'sessions', 'assessments']

const triggerClass = cn(
  'h-9 flex-none rounded-xl border-0 bg-transparent px-3.5 py-0 text-sm font-medium text-slate-500 shadow-none',
  'hover:bg-slate-50 hover:text-slate-800',
  'data-[state=active]:bg-sky-50 data-[state=active]:text-sky-700 data-[state=active]:shadow-none',
  'dark:data-[state=active]:bg-sky-50 dark:data-[state=active]:text-sky-700',
)

export function PatientViewMenu({
  value,
  onChange,
  disabled = false,
  className,
}: PatientViewMenuProps) {
  const { t } = useI18n()

  const label = (view: PatientWorkspaceView) => {
    switch (view) {
      case 'profile':
        return t.workflow.patientViewProfile
      case 'assessments':
        return t.workflow.patientViewAssessments
      default:
        return t.workflow.patientViewSessions
    }
  }

  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as PatientWorkspaceView)}
      className={cn('gap-0', disabled && 'pointer-events-none opacity-45', className)}
    >
      <TabsList className="inline-flex h-auto w-fit justify-start gap-1 rounded-2xl border border-border bg-slate-50/80 p-1">
        {VIEWS.map((view) => (
          <TabsTrigger key={view} value={view} disabled={disabled} className={triggerClass}>
            {label(view)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
