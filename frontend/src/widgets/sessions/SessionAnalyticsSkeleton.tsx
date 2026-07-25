import { useI18n } from '../../i18n/context'
import { cn } from '@/shared/lib/utils'

function Bone({ className }: { className?: string }) {
  return <div className={cn('rounded-md bg-slate-100', className)} />
}

/** Static outline of summary + chart when no session is selected. */
export function SessionAnalyticsSkeleton({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()

  return (
    <div className={cn('grid', compact ? 'gap-2.5' : 'gap-4')} aria-hidden>
      <section
        className={cn(
          'rounded-2xl border border-dashed border-slate-200 bg-white',
          'shadow-[0_12px_30px_rgb(15_23_42/0.04)]',
          compact ? 'p-3' : 'p-4',
        )}
      >
        <div className={cn('flex flex-wrap items-start justify-between gap-2', compact ? 'mb-2' : 'mb-3')}>
          <div className="grid gap-2">
            <Bone className="h-5 w-40" />
            <Bone className="h-3 w-28" />
          </div>
          <div className="flex gap-1">
            <Bone className="h-6 w-14 rounded-full" />
            <Bone className="h-6 w-12 rounded-full" />
            <Bone className="h-6 w-12 rounded-full" />
          </div>
        </div>

        <div className={cn('grid', compact ? 'gap-2.5' : 'gap-3')}>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Bone key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-2.5 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid gap-1">
                <Bone className="h-2.5 w-14" />
                <Bone className="h-3.5 w-16" />
              </div>
            ))}
          </div>
        </div>

        <p className="m-0 mt-3 text-center text-xs font-semibold text-slate-400">
          {t.workflow.selectSessionForAnalytics}
        </p>
      </section>

      <section
        className={cn(
          'rounded-2xl border border-dashed border-slate-200 bg-white',
          'shadow-[0_12px_30px_rgb(15_23_42/0.04)]',
          compact ? 'p-3' : 'p-4',
        )}
      >
        <div className={cn('flex flex-wrap items-start justify-between gap-2', compact ? 'mb-2.5' : 'mb-4')}>
          <div className="grid gap-2">
            <Bone className="h-5 w-48" />
            <Bone className="h-3 w-24" />
          </div>
          <div className="flex gap-1">
            <Bone className="h-6 w-16 rounded-full" />
            <Bone className="h-6 w-16 rounded-full" />
            <Bone className="h-6 w-16 rounded-full" />
            <Bone className="h-6 w-16 rounded-full" />
          </div>
        </div>
        <div className={cn('grid grid-cols-2 gap-2', compact ? 'mb-2.5' : 'mb-4 sm:grid-cols-4')}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid gap-1">
              <Bone className="h-3 w-14" />
              <Bone className="h-4 w-16" />
            </div>
          ))}
        </div>
        <Bone className={cn('w-full rounded-xl', compact ? 'h-[180px]' : 'h-[220px] max-[640px]:h-[180px]')} />
      </section>
    </div>
  )
}
