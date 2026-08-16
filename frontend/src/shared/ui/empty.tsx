import * as React from 'react'
import { cn } from '@/shared/lib/utils'

function Empty({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty"
      className={cn(
        'flex min-h-[180px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border p-6 text-center',
        className,
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="empty-header" className={cn('grid justify-items-center gap-2', className)} {...props} />
}

function EmptyMedia({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-media"
      className={cn('flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground', className)}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="empty-title" className={cn('text-sm font-semibold text-foreground', className)} {...props} />
}

function EmptyDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="empty-description" className={cn('m-0 text-sm text-muted-foreground', className)} {...props} />
}

export { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle }
