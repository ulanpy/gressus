import { useI18n } from '../../i18n/context'
import { cn } from '../../lib/cn'

function Bone({ className }: { className?: string }) {
  return <div className={cn('rounded-md bg-slate-100', className)} />
}

/** Static outline of summary + chart when no session is selected. */
export function SessionAnalyticsSkeleton() {
  const { t } = useI18n()

  return (
    <div className="grid gap-4" aria-hidden>
      <section
        className={cn(
          'rounded-2xl border border-dashed border-slate-200 bg-white p-4',
          'shadow-[0_12px_30px_rgb(15_23_42/0.04)]',
        )}
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-2">
            <Bone className="h-5 w-40" />
            <Bone className="h-3 w-28" />
          </div>
          <div className="flex gap-1.5">
            <Bone className="h-7 w-16 rounded-full" />
            <Bone className="h-7 w-14 rounded-full" />
            <Bone className="h-7 w-14 rounded-full" />
          </div>
        </div>

        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <Bone className="h-16 w-16 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 grid gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[88px_minmax(0,1fr)_40px] items-center gap-2">
                  <Bone className="h-3 w-full" />
                  <Bone className="h-1.5 w-full rounded-full" />
                  <Bone className="h-3 w-full" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid gap-1.5">
                <Bone className="h-3 w-16" />
                <Bone className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>

        <p className="m-0 mt-4 text-center text-sm font-semibold text-slate-400">
          {t.workflow.selectSessionForAnalytics}
        </p>
      </section>

      <section
        className={cn(
          'rounded-2xl border border-dashed border-slate-200 bg-white p-4',
          'shadow-[0_12px_30px_rgb(15_23_42/0.04)]',
        )}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-2">
            <Bone className="h-5 w-48" />
            <Bone className="h-3 w-24" />
          </div>
          <div className="flex gap-1.5">
            <Bone className="h-7 w-20 rounded-full" />
            <Bone className="h-7 w-20 rounded-full" />
            <Bone className="h-7 w-20 rounded-full" />
            <Bone className="h-7 w-20 rounded-full" />
          </div>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid gap-1.5">
              <Bone className="h-3 w-14" />
              <Bone className="h-4 w-16" />
            </div>
          ))}
        </div>
        <Bone className="h-[220px] w-full rounded-xl max-[640px]:h-[180px]" />
      </section>
    </div>
  )
}
