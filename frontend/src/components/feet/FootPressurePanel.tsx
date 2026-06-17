import { cn } from '../../lib/cn'
import { useI18n } from '../../i18n/context'
import type { FootPressurePanelProps } from '../../types/components'
import { CONTACT_THRESHOLD_KPA, SENSOR_COUNT } from '../../constants/insole'
import { formatKpa } from '../../lib/format'
import {
  eyebrow,
  feetPanelSide,
  footCard,
  footCardBody,
  footCardBodyEmbedded,
  footCardHead,
  footCardTitle,
  footVisual,
  metricsGrid,
  pill,
  pillOk,
  pillWarn,
} from '../../styles/ui'
import { Metric } from '../layout/Metric'
import { FootHeatmap } from './FootHeatmap'


export function FootPressurePanel({
  embedded,
  side,
  frame,
  scale,
  showSensors,
  silhouette,
}: FootPressurePanelProps & { embedded?: boolean }) {
  const { t } = useI18n()
  const activeSensorCount = frame.points.filter((point) => point.pressure >= CONTACT_THRESHOLD_KPA).length
  const onlineLabel = frame.online ? t.live.online : t.live.waiting
  const rootClass = embedded ? feetPanelSide : footCard

  const content = (
    <>
      <div className={footCardHead}>
        <div>
          <p className={eyebrow}>{side === 'left' ? t.live.leftInsole : t.live.rightInsole}</p>
          <h2 className={footCardTitle}>{frame.stats.pressed ? t.live.contact : t.live.pressureMap}</h2>
        </div>
        <span className={cn(pill, frame.online ? pillOk : pillWarn)}>{onlineLabel}</span>
      </div>

      <div className={cn(footCardBody, embedded && footCardBodyEmbedded)}>
        <div className={footVisual}>
          <FootHeatmap
            frame={frame}
            idPrefix={`${side}-therapist`}
            scale={scale}
            showSensors={showSensors}
            silhouette={silhouette}
            title={side === 'left' ? t.live.leftAria : t.live.rightAria}
          />
        </div>

        <div className={metricsGrid}>
          <Metric label={t.live.peak} value={formatKpa(frame.stats.maxKpa)} accent="rose" />
          <Metric label={t.live.average} value={formatKpa(frame.stats.meanKpa)} accent="cyan" />
          <Metric label={t.live.load} value={`${Math.round(frame.stats.sumKpa / 10)} u`} accent="amber" />
          <Metric label={t.live.sensors} value={`${activeSensorCount}/${SENSOR_COUNT}`} accent="green" />
        </div>
      </div>
    </>
  )

  if (embedded) {
    return <div className={rootClass}>{content}</div>
  }

  return <article className={rootClass}>{content}</article>
}
