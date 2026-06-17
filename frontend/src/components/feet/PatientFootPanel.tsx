import { cn } from '../../lib/cn'
import { useI18n } from '../../i18n/context'
import type { PatientFootPanelProps } from '../../types/components'
import { patientPressureLevel } from '../../lib/patient/pressureLevel'
import {
  eyebrow,
  panel,
  patientFootCopyTitle,
  patientFootEmbedded,
  patientFootGrid,
  patientFootLight,
  patientFootSteady,
  patientFootStrong,
  patientFootVisual,
  patientFootWaiting,
} from '../../styles/ui'
import { FootHeatmap } from './FootHeatmap'


const pressureBackground = {
  waiting: patientFootWaiting,
  light: patientFootLight,
  steady: patientFootSteady,
  strong: patientFootStrong,
} as const


export function PatientFootPanel({
  embedded,
  frame,
  scale,
  side,
  silhouette,
}: PatientFootPanelProps & { embedded?: boolean }) {
  const { t } = useI18n()
  const pressureLevel = patientPressureLevel(frame)
  const statusText = t.patient.pressure[pressureLevel]
  const rootClass = embedded
    ? patientFootEmbedded
    : cn(panel, patientFootGrid, pressureBackground[pressureLevel])

  const inner = (
    <>
      <div>
        <p className={eyebrow}>{side === 'left' ? t.live.leftFoot : t.live.rightFoot}</p>
        <h2 className={patientFootCopyTitle}>{statusText}</h2>
      </div>

      <div className={patientFootVisual}>
        <FootHeatmap
          frame={frame}
          idPrefix={`${side}-patient`}
          scale={scale}
          showSensors={false}
          silhouette={silhouette}
          title={side === 'left' ? t.live.leftAria : t.live.rightAria}
        />
      </div>
    </>
  )

  if (embedded) {
    return <div className={rootClass}>{inner}</div>
  }

  return <article className={rootClass}>{inner}</article>
}
