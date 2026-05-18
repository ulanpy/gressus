import { useI18n } from '../../i18n/context'
import type { PatientFootPanelProps } from '../../types/components'
import { patientPressureLevel } from '../../lib/patient/pressureLevel'
import { FootHeatmap } from './FootHeatmap'


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
    ? `feet-panel__side patient-foot patient-foot--embedded patient-foot--${pressureLevel}`
    : `patient-foot patient-foot--${pressureLevel}`

  const inner = (
    <>
      <div className="patient-foot__copy">
        <p className="eyebrow">{side === 'left' ? t.live.leftFoot : t.live.rightFoot}</p>
        <h2>{statusText}</h2>
      </div>

      <div className="patient-foot__visual">
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
