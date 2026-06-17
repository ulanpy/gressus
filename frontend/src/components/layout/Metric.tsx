import type { MetricProps } from '../../types/components'
import { cn } from '../../lib/cn'
import { panel } from '../../styles/ui'

const accentColors: Record<string, string> = {
  rose: 'text-rose-500',
  cyan: 'text-cyan-500',
  amber: 'text-amber-500',
  green: 'text-emerald-500',
}

export function Metric({ label, value, accent }: MetricProps) {
  return (
    <div className={cn(panel, 'grid min-w-0 rounded-[20px] p-4')}>
      <span className="text-xs tracking-[0.08em] text-muted uppercase">{label}</span>
      <strong
        className={cn(
          'mt-[7px] block min-w-[7ch] text-2xl leading-[1.1] whitespace-nowrap tabular-nums',
          accentColors[accent],
        )}
      >
        {value}
      </strong>
    </div>
  )
}
