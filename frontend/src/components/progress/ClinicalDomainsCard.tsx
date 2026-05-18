import { useI18n } from '../../i18n/context'
import { percentImprovement, percentReduction, formatSignedPercent } from '../../lib/format'
import type { ClinicalDomainsCardProps } from '../../types/components'
import { CardHeading } from '../layout/CardHeading'


export function ClinicalDomainsCard({ metrics }: ClinicalDomainsCardProps) {
  const { t } = useI18n()
  const baseline = metrics[0]
  const latest = metrics[metrics.length - 1]
  const domains = [
    {
      label: t.progress.domains.symmetry,
      baseline: baseline.symmetryScore,
      latest: latest.symmetryScore,
      unit: t.progress.domains.score,
      improvement: percentImprovement(baseline.symmetryScore, latest.symmetryScore),
    },
    {
      label: t.progress.domains.stability,
      baseline: baseline.stabilityScore,
      latest: latest.stabilityScore,
      unit: t.progress.domains.score,
      improvement: percentImprovement(baseline.stabilityScore, latest.stabilityScore),
    },
    {
      label: t.progress.domains.loadBalance,
      baseline: Math.abs(baseline.leftAvgPressure - baseline.rightAvgPressure),
      latest: Math.abs(latest.leftAvgPressure - latest.rightAvgPressure),
      unit: t.progress.domains.gap,
      improvement: percentReduction(
        Math.abs(baseline.leftAvgPressure - baseline.rightAvgPressure),
        Math.abs(latest.leftAvgPressure - latest.rightAvgPressure),
      ),
    },
    {
      label: t.progress.domains.variability,
      baseline: baseline.variabilityScore,
      latest: latest.variabilityScore,
      unit: t.progress.domains.index,
      improvement: percentReduction(baseline.variabilityScore, latest.variabilityScore),
    },
  ]

  return (
    <article className="progress-card">
      <CardHeading eyebrow={t.progress.domains.eyebrow} title={t.progress.domains.title} />
      <div className="domain-list">
        {domains.map((domain) => (
          <div className="domain-row" key={domain.label}>
            <div>
              <strong>{domain.label}</strong>
              <span>
                {Math.round(domain.baseline)} → {Math.round(domain.latest)} {domain.unit}
              </span>
            </div>
            <b>{formatSignedPercent(domain.improvement)}</b>
          </div>
        ))}
      </div>
    </article>
  )
}
