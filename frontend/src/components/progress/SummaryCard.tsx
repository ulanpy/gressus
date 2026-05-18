import type { SummaryCardProps } from '../../types/components'


export function SummaryCard({ label, value, trend }: SummaryCardProps) {
  return (
    <article className="progress-card summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{trend}</p>
    </article>
  )
}
