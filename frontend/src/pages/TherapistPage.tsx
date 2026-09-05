import { useI18n } from '../i18n/context'
import type { TherapistPageProps } from '../types/components'
import { FeetPressurePanel } from '@/widgets/feet/FeetPressurePanel'
import { cn } from '@/shared/lib/utils'
import { container, eyebrow } from '../styles/ui'


export function TherapistPage({
  dashboard,
}: TherapistPageProps) {
  const { t } = useI18n()

  return (
    <>
      <section
        className={cn(
          container,
          'mb-2 grid grid-cols-1 items-end gap-8 min-[981px]:grid-cols-[minmax(0,1fr)_360px]',
        )}
      >
        <div>
          <p className={cn(eyebrow, 'inline-flex items-center gap-2')}>
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500"
              aria-hidden
            />
            {t.therapist.eyebrow}
          </p>
          <h1 className="m-0 max-w-[760px] text-[clamp(32px,6vw,56px)] leading-[0.95] tracking-[-0.06em] text-text-strong">
            {t.therapist.title}
          </h1>
        </div>
      </section>

      <FeetPressurePanel dashboard={dashboard} />
    </>
  )
}
