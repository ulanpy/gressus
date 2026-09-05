import type { ReactNode } from 'react'
import { ClipboardPlus, Compass, Users } from 'lucide-react'
import { useI18n } from '@/i18n/context'
import type { PatientSessionWorkflow } from '@/hooks/usePatientSessionWorkflow'
import type { ViewMode } from '@/types/navigation'
import { cn } from '@/shared/lib/utils'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from '@/shared/ui/navigation-menu'

type AppNavigationProps = {
  activeView: ViewMode
  setActiveView: (view: ViewMode) => void
  workflow: PatientSessionWorkflow
}

function ViewLink({
  active,
  onSelect,
  children,
}: {
  active?: boolean
  onSelect: () => void
  children: ReactNode
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
      )}
    >
      {children}
    </button>
  )
}

export function AppNavigation({
  activeView,
  setActiveView,
  workflow,
}: AppNavigationProps) {
  const { t } = useI18n()

  const goPatientList = () => {
    workflow.selectPatient(null)
    setActiveView('control')
  }

  return (
    <NavigationMenu viewport={false} className="relative z-50 max-w-none justify-start">
      <NavigationMenuList className="flex-wrap items-center justify-start gap-1 rounded-2xl border border-border bg-white p-1 shadow-panel">
        <NavigationMenuItem>
          <ViewLink
            active={activeView === 'therapist'}
            onSelect={() => setActiveView('therapist')}
          >
            <Compass className="size-4" />
            {t.tabs.therapist}
          </ViewLink>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <ViewLink active={activeView === 'control'} onSelect={goPatientList}>
            <Users className="size-4" />
            {t.tabs.control}
          </ViewLink>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <ViewLink
            active={activeView === 'sessions'}
            onSelect={() => setActiveView('sessions')}
          >
            <ClipboardPlus className="size-4" />
            {t.tabs.sessions}
          </ViewLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}
