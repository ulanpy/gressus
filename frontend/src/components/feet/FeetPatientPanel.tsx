import type { FootDashboard } from '../../types/insole'
import { useI18n } from '../../i18n/context'
import { feetPanel, feetPanelPair, feetPanelSep } from '../../styles/ui'
import { PatientFootPanel } from './PatientFootPanel'


export function FeetPatientPanel({ dashboard }: { dashboard: FootDashboard }) {
  const { t } = useI18n()

  return (
    <article className={feetPanel} aria-label={t.live.patientFeetAria}>
      <div className={feetPanelPair}>
        <PatientFootPanel
          embedded
          side="left"
          frame={dashboard.leftFrame}
          scale={dashboard.dynamicScale}
          silhouette={dashboard.leftSilhouette}
        />
        <div className={feetPanelSep} aria-hidden />
        <PatientFootPanel
          embedded
          side="right"
          frame={dashboard.rightFrame}
          scale={dashboard.dynamicScale}
          silhouette={dashboard.rightSilhouette}
        />
      </div>
    </article>
  )
}
