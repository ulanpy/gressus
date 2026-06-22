import type { ReactNode } from 'react'
import { useI18n } from '../../i18n/context'
import { cn } from '../../lib/cn'
import { DocumentIcon, HistoryIcon, PersonIcon } from './PatientFieldIcons'

export type PatientWorkspaceView = 'profile' | 'sessions' | 'assessments'

type PatientViewMenuProps = {
  value: PatientWorkspaceView
  onChange: (view: PatientWorkspaceView) => void
  disabled?: boolean
  className?: string
}

const VIEWS: PatientWorkspaceView[] = ['profile', 'sessions', 'assessments']

const VIEW_ICONS: Record<PatientWorkspaceView, ReactNode> = {
  profile: <PersonIcon className="h-4 w-4" />,
  sessions: <HistoryIcon className="h-4 w-4" />,
  assessments: <DocumentIcon className="h-4 w-4" />,
}

export function PatientViewMenu({
  value,
  onChange,
  disabled = false,
  className,
}: PatientViewMenuProps) {
  const { t } = useI18n()

  const label = (view: PatientWorkspaceView) => {
    switch (view) {
      case 'sessions':
        return t.workflow.patientViewSessions
      case 'assessments':
        return t.workflow.patientViewAssessments
      default:
        return t.workflow.patientViewProfile
    }
  }

  return (
    <nav
      className={cn(
        'mb-6 flex w-full flex-wrap items-end gap-7 border-b border-[#e7edf5]',
        disabled && 'pointer-events-none opacity-45',
        className,
      )}
      role="tablist"
    >
      {VIEWS.map((view) => {
        const selected = view === value
        return (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={selected}
            data-active={selected ? 'true' : 'false'}
            className={cn(
              '-mb-px inline-flex h-[42px] cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-0.5 text-sm font-semibold whitespace-nowrap transition-[color,border-color] duration-150',
              selected
                ? 'border-indigo-500 text-[#14213d] [&_svg]:text-indigo-500'
                : 'border-transparent text-slate-500 hover:text-slate-700 [&_svg]:text-slate-400',
            )}
            disabled={disabled}
            onClick={() => onChange(view)}
          >
            {VIEW_ICONS[view]}
            {label(view)}
          </button>
        )
      })}
    </nav>
  )
}
