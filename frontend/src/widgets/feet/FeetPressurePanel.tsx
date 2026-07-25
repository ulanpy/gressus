import type { FootDashboard } from '../../types/insole'
import { useI18n } from '../../i18n/context'
import { feetPanel, feetPanelPair, feetPanelSep } from '../../styles/ui'
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
    <article className={feetPanel} aria-label={t.live.feetAria}>
      <div className={feetPanelPair}>
        <FootPressurePanel
          embedded
          side="left"
          frame={dashboard.leftFrame}
          scale={dashboard.dynamicScale}
          showSensors={showSensors}
          silhouette={dashboard.leftSilhouette}
        />
        <div className={feetPanelSep} aria-hidden />
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
