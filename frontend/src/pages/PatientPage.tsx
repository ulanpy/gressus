import { useI18n } from '../i18n/context'
import type { PatientPageProps } from '../types/components'
import { LiveInactiveCard } from '../components/session/LiveInactiveCard'
import { AppleTreeGarden } from '../components/patient/AppleTreeGarden'


export function PatientPage({ dashboard, frame, liveInactive }: PatientPageProps) {
  const { t } = useI18n()

  if (liveInactive) {
    return <LiveInactiveCard variant="patient" />
  }

  return (
    <>
      {frame?.error && <p className="error">{t.patient.error}</p>}
      <AppleTreeGarden frame={frame} dashboard={dashboard} />
    </>
  )
}
