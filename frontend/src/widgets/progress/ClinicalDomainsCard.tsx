import { useI18n } from '../../i18n/context'
import { percentImprovement, percentReduction, formatSignedPercent } from '../../lib/format'
import { progressCard } from '../../styles/ui'
import type { ClinicalDomainsCardProps } from '../../types/components'
import { CardHeading } from '@/shared/layout/CardHeading'

const domainRow =
  'flex justify-between items-center gap-[18px] p-4 border border-slate-200/72 rounded-[20px] bg-white/58'


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
  ]

  return (
    <article className={progressCard}>
      <CardHeading eyebrow={t.progress.domains.eyebrow} title={t.progress.domains.title} />
      <div className="grid gap-3">
        {domains.map((domain) => (
          <div className={domainRow} key={domain.label}>
            <div>
              <strong className="block text-text-strong text-base">{domain.label}</strong>
              <span className="text-muted text-[13px]">
                {Math.round(domain.baseline)} → {Math.round(domain.latest)} {domain.unit}
              </span>
            </div>
            <b className="shrink-0 text-cyan-700 text-lg">{formatSignedPercent(domain.improvement)}</b>
          </div>
        ))}
      </div>
    </article>
  )
}
