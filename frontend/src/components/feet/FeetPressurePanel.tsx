import type { FootDashboard } from '../../types/insole'
import { useI18n } from '../../i18n/context'
import { FootPressurePanel } from './FootPressurePanel'


export function FeetPressurePanel({
  dashboard,
  showSensors,
}: {
  dashboard: FootDashboard
  showSensors: boolean
}) {
  const { t } = useI18n()

  return (
    <article className="feet-panel" aria-label={t.live.feetAria}>
      <div className="feet-panel__pair">
        <FootPressurePanel
          embedded
          side="left"
          frame={dashboard.leftFrame}
          scale={dashboard.dynamicScale}
          showSensors={showSensors}
          silhouette={dashboard.leftSilhouette}
        />
        <div className="feet-panel__sep" aria-hidden />
        <FootPressurePanel
          embedded
          side="right"
          frame={dashboard.rightFrame}
          scale={dashboard.dynamicScale}
          showSensors={showSensors}
          silhouette={dashboard.rightSilhouette}
        />
      </div>
    </article>
  )
}
