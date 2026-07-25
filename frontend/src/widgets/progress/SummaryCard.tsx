import type { SummaryCardProps } from '../../types/components'
import { cn } from '@/shared/lib/utils'
import { progressCard } from '../../styles/ui'


export function SummaryCard({ label, value, trend }: SummaryCardProps) {
  return (
    <article className={cn(progressCard, 'min-h-[154px]')}>
      <span className="text-muted text-[13px]">{label}</span>
      <strong className="block mt-3.5 text-text-strong text-[38px] leading-none">{value}</strong>
      <p className="mt-3.5 mb-0 text-cyan-700 text-sm font-bold">{trend}</p>
    </article>
  )
}
