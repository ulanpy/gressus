import { useI18n } from '@/i18n/context'
import { cn } from '@/shared/lib/utils'
import { normalizePatientSide } from '@/lib/patient/side'

type LateralityMode = 'affected' | 'dominant'

type LateralityIndicatorProps = {
  mode: LateralityMode
  dominantSide?: string | null
  affectedSide?: string | null
  /** pair = L+R chips; single = only active side (sidebar) */
  variant?: 'pair' | 'single'
  className?: string
}

function Chip({
  short,
  active,
  mode,
  title,
}: {
  short: 'L' | 'R'
  active: boolean
  mode: LateralityMode
  title: string
}) {
  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold',
        !active && 'border border-slate-200 bg-slate-50 text-slate-300',
        active &&
          mode === 'affected' &&
          'border border-amber-500 bg-amber-400 text-white',
        active &&
          mode === 'dominant' &&
          'border-2 border-sky-500 bg-white text-sky-700',
      )}
    >
      {short}
    </span>
  )
}

export function LateralityIndicator({
  mode,
  dominantSide,
  affectedSide,
  variant = 'pair',
  className,
}: LateralityIndicatorProps) {
  const { t } = useI18n()
  const labels = t.workflow

  const side =
    mode === 'affected'
      ? normalizePatientSide(affectedSide, labels)
      : normalizePatientSide(dominantSide, labels)

  if (!side) {
    return <span className={cn('text-slate-400', className)}>{labels.notSpecified}</span>
  }

  const roleLabel = mode === 'affected' ? labels.affectedSide : labels.dominantSide
  const short = side === 'left' ? 'L' : 'R'

  if (variant === 'single') {
    return (
      <Chip short={short} active mode={mode} title={roleLabel} />
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} role="group" aria-label={roleLabel}>
      <Chip
        short="L"
        active={side === 'left'}
        mode={mode}
        title={side === 'left' ? roleLabel : labels.sideLeft}
      />
      <Chip
        short="R"
        active={side === 'right'}
        mode={mode}
        title={side === 'right' ? roleLabel : labels.sideRight}
      />
    </span>
  )
}
