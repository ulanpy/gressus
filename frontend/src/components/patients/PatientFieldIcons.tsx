import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type IconProps = { className?: string }

function IconBase({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      className={cn('h-5 w-5', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </IconBase>
  )
}

export function GenderIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M12 12v9M9 18h6" />
    </IconBase>
  )
}

export function ArrowsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m7 16-4-4 4-4" />
      <path d="M3 12h14" />
      <path d="m17 8 4 4-4 4" />
    </IconBase>
  )
}

export function PersonIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="7" r="3.5" />
      <path d="M5 21c0-3.5 3.1-6 7-6s7 2.5 7 6" />
    </IconBase>
  )
}

export function ShieldIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3 20 7v6c0 4.5-3.5 7.5-8 8-4.5-.5-8-3.5-8-8V7l8-4z" />
    </IconBase>
  )
}

export function HeartIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z" />
    </IconBase>
  )
}

export function PhoneIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5L17.5 13 22 14.5V18a2 2 0 0 1-2 2C9.6 20 4 14.4 4 6.5A2.5 2.5 0 0 1 6.5 4z" />
    </IconBase>
  )
}

export function DocumentIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 3h6l4 4v14H8z" />
      <path d="M14 3v5h5M10 13h8M10 17h6" />
    </IconBase>
  )
}

export function HistoryIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </IconBase>
  )
}
