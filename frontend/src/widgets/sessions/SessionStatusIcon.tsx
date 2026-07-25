import type { ReactNode } from 'react'
import { useI18n } from '../../i18n/context'
import { cn } from '@/shared/lib/utils'
import type { SessionStatus } from '../../types/sessions'

type SessionStatusIconProps = {
  status: SessionStatus
  className?: string
}

function IconShell({
  className,
  children,
  title,
}: {
  className?: string
  children: ReactNode
  title: string
}) {
  return (
    <span
      className={cn(
        'inline-grid h-4 w-4 shrink-0 place-items-center text-slate-400',
        className,
      )}
      title={title}
      aria-label={title}
      role="img"
    >
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </span>
  )
}

export function SessionStatusIcon({ status, className }: SessionStatusIconProps) {
  const { t } = useI18n()

  switch (status) {
    case 'completed':
      return (
        <IconShell className={className} title={t.workflow.statusTooltipCompleted}>
          <path d="M20 6 9 17l-5-5" />
        </IconShell>
      )
    case 'active':
      return (
        <IconShell className={className} title={t.workflow.statusTooltipActive}>
          <circle cx="12" cy="12" r="3.5" />
        </IconShell>
      )
    case 'failed':
      return (
        <IconShell className={className} title={t.workflow.statusTooltipFailed}>
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </IconShell>
      )
    case 'aborted':
      return (
        <IconShell className={className} title={t.workflow.statusTooltipAborted}>
          <rect x="8" y="8" width="8" height="8" rx="0.5" />
        </IconShell>
      )
  }
}
