import { useI18n } from '../i18n/context'
import type { PatientPageProps } from '../types/components'
import { LiveInactiveCard } from '../components/session/LiveInactiveCard'
import { AppleTreeGarden } from '../components/patient/AppleTreeGarden'
import { cn } from '../lib/cn'
import { container } from '../styles/ui'


export function PatientPage({ dashboard, frame, liveInactive }: PatientPageProps) {
  const { t } = useI18n()

  if (liveInactive) {
    return <LiveInactiveCard variant="patient" />
  }

  return (
    <>
      {frame?.error && (
        <p
          className={cn(
            container,
            'mt-[18px] rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-red-800',
          )}
        >
          {t.patient.error}
        </p>
      )}
      <AppleTreeGarden frame={frame} dashboard={dashboard} />
    </>
  )
}
