import { cn } from '@/shared/lib/utils'
import { useI18n } from '../../i18n/context'
import {
  eyebrow,
  liveInactive,
  liveInactiveCopy,
  liveInactiveIcon,
  liveInactivePatient,
  liveInactiveText,
  liveInactiveTitle,
  liveInactiveTitlePatient,
} from '../../styles/ui'


export function LiveInactiveCard({ variant }: { variant: 'therapist' | 'patient' }) {
  const { t } = useI18n()
  const isPatient = variant === 'patient'
  return (
    <section
      className={cn(liveInactive, isPatient && liveInactivePatient)}
      aria-live="polite"
    >
      <div className={liveInactiveIcon} aria-hidden>
        <svg viewBox="0 0 64 64" width="56" height="56">
          <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35" />
          <circle cx="32" cy="32" r="6" fill="currentColor" />
        </svg>
      </div>
      <div className={liveInactiveCopy}>
        <p className={eyebrow}>{t.live.inactiveEyebrow}</p>
        <h2 className={cn(liveInactiveTitle, isPatient && liveInactiveTitlePatient)}>
          {isPatient ? t.live.inactivePatientTitle : t.live.inactiveTherapistTitle}
        </h2>
        <p className={liveInactiveText}>
          {isPatient ? t.live.inactivePatientText : t.live.inactiveTherapistText}
        </p>
      </div>
    </section>
  )
}
