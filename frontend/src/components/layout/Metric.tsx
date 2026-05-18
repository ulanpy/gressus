import type { MetricProps } from '../../types/components'


export function Metric({ label, value, accent }: MetricProps) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={accent}>{value}</strong>
    </div>
  )
}
