import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'

export type ExoskeletonIconName =
  | 'alert'
  | 'check'
  | 'clock'
  | 'gear'
  | 'lock'
  | 'play'
  | 'refresh'
  | 'stop'
  | 'unlock'
  | 'upload'
  | 'wifi'

export function ExoskeletonIcon({ name, className }: { name: ExoskeletonIconName; className?: string }) {
  const common = {
    className: cn('h-6 w-6', className),
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2,
    viewBox: '0 0 24 24',
  }

  if (name === 'alert') {
    return (
      <svg {...common}>
        <path d="M12 4 21 20H3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    )
  }
  if (name === 'check') {
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    )
  }
  if (name === 'clock') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  }
  if (name === 'gear') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.4 3a8 8 0 0 0-1.7 1L5 6 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5 18l2.4-1a8 8 0 0 0 1.7 1l.4 3h5l.4-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2.1-1.5a7 7 0 0 0 .1-1Z" />
      </svg>
    )
  }
  if (name === 'lock') {
    return (
      <svg {...common}>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    )
  }
  if (name === 'play') {
    return (
      <svg {...common}>
        <path d="M8 5v14l11-7Z" />
      </svg>
    )
  }
  if (name === 'refresh') {
    return (
      <svg {...common}>
        <path d="M20 12a8 8 0 1 1-2.3-5.6" />
        <path d="M20 4v6h-6" />
      </svg>
    )
  }
  if (name === 'stop') {
    return (
      <svg {...common}>
        <rect x="7" y="7" width="10" height="10" rx="2" />
      </svg>
    )
  }
  if (name === 'unlock') {
    return (
      <svg {...common}>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 7-2.7" />
      </svg>
    )
  }
  if (name === 'upload') {
    return (
      <svg {...common}>
        <path d="M12 4v12" />
        <path d="m7 9 5-5 5 5" />
        <path d="M5 20h14" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M5 14a10 10 0 0 1 14 0" />
      <path d="M8.5 17.5a5 5 0 0 1 7 0" />
      <path d="M12 21h.01" />
    </svg>
  )
}

export function ExoskeletonPrimaryAction({
  disabled,
  icon,
  onClick,
  subtitle,
  title,
  variant = 'primary',
}: {
  disabled?: boolean
  icon: ExoskeletonIconName
  onClick: () => void
  subtitle: string
  title: string
  variant?: 'danger' | 'primary'
}) {
  return (
    <Button
      type="button"
      variant={variant === 'danger' ? 'destructive' : 'default'}
      className={cn(
        'inline-grid h-auto shrink-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-2xl border px-4 py-3 text-left text-white transition-transform hover:-translate-y-0.5',
        variant === 'danger'
          ? 'border-red-600 bg-red-600 shadow-[0_14px_28px_rgb(220_38_38/0.22)] hover:bg-red-600'
          : 'border-slate-950 bg-slate-950 shadow-[0_14px_28px_rgb(15_23_42/0.16)] hover:bg-slate-950',
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-white/12">
        <ExoskeletonIcon name={icon} className="h-5 w-5 text-white" />
      </span>
      <span className="min-w-0 pr-1">
        <span className="block text-[16px] font-extrabold leading-tight">{title}</span>
        <span className="mt-0.5 block text-[12px] font-semibold leading-4 text-white/70">{subtitle}</span>
      </span>
    </Button>
  )
}
