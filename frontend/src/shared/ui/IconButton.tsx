import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'

type IconProps = {
  className?: string
}

/** Horizontal swap arrows — exchange / switch patient. */
export function SwapIcon({ className }: IconProps) {
  return (
    <svg
      className={cn('h-[18px] w-[18px]', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 4 4 8l4 4" />
      <path d="M4 8h16" />
      <path d="m16 20 4-4-4-4" />
      <path d="M20 16H4" />
    </svg>
  )
}

export function PencilIcon({ className }: IconProps) {
  return (
    <svg
      className={cn('h-[18px] w-[18px]', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg
      className={cn('h-[18px] w-[18px]', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

/** Document with plus — new record / assessment. */
export function FilePlusIcon({ className }: IconProps) {
  return (
    <svg
      className={cn('h-[18px] w-[18px]', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M12 18v-6" />
      <path d="M9 15h6" />
    </svg>
  )
}

export function ArchiveIcon({ className }: IconProps) {
  return (
    <svg
      className={cn('h-[18px] w-[18px]', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="4" width="20" height="5" rx="1" />
      <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
      <path d="M10 13h4" />
    </svg>
  )
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg
      className={cn('h-[18px] w-[18px]', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="9 6 18 12 9 18 9 6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function StopIcon({ className }: IconProps) {
  return (
    <svg
      className={cn('h-[18px] w-[18px]', className)}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
    </svg>
  )
}

type IconButtonProps = {
  label: string
  onClick?: () => void
  disabled?: boolean
  variant?: 'default' | 'primary' | 'danger'
  className?: string
  children: ReactNode
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, onClick, disabled, variant = 'default', className, children },
  ref,
) {
  const buttonVariant =
    variant === 'primary' ? 'default' : variant === 'danger' ? 'outline' : 'outline'

  return (
    <Button
      ref={ref}
      type="button"
      variant={buttonVariant}
      size="icon"
      className={cn(
        'rounded-full shadow-[0_4px_14px_rgb(15_23_42/0.06)]',
        variant === 'default' && 'border-panel-border hover:border-cyan-400',
        variant === 'danger' && 'text-destructive hover:border-red-400 hover:bg-red-50',
        className,
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  )
})
