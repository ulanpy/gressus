import { useI18n } from '../i18n/context'
import { patientMessageText } from '../lib/i18nText'
import type { PatientPageProps } from '../types/components'
import { LiveInactiveCard } from '../components/session/LiveInactiveCard'
import { FeetPatientPanel } from '../components/feet/FeetPatientPanel'


export function PatientPage({ dashboard, frame, liveInactive, movementMessage }: PatientPageProps) {
  const { t } = useI18n()

  if (liveInactive) {
    return <LiveInactiveCard variant="patient" />
  }

  return (
    <>
      {frame?.error && <p className="error">{t.patient.error}</p>}

      <FeetPatientPanel dashboard={dashboard} />

      <section className="patient-hero">
        <div>
          <p className="eyebrow">{t.patient.mode}</p>
        </div>

        <div className="patient-message" aria-live="polite">
          <span>{frame?.connected === false ? t.patient.signalWaiting : t.patient.yourStep}</span>
          <strong>{patientMessageText(movementMessage, t)}</strong>
        </div>
      </section>

      <section className="patient-guide">
        <div className="patient-guide__item patient-guide__item--cool">
          <span />
          <strong>{t.patient.guideLight}</strong>
        </div>
        <div className="patient-guide__item patient-guide__item--warm">
          <span />
          <strong>{t.patient.guideStrong}</strong>
        </div>
        <div className="patient-guide__item patient-guide__item--calm">
          <span />
          <strong>{t.patient.guideCalm}</strong>
        </div>
      </section>
    </>
  )
}
