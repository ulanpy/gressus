import { useI18n } from '../../i18n/context'


export function LiveInactiveCard({ variant }: { variant: 'therapist' | 'patient' }) {
  const { t } = useI18n()
  const isPatient = variant === 'patient'
  return (
    <section className={`live-inactive ${isPatient ? 'live-inactive--patient' : ''}`} aria-live="polite">
      <div className="live-inactive__icon" aria-hidden>
        <svg viewBox="0 0 64 64" width="56" height="56">
          <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35" />
          <circle cx="32" cy="32" r="6" fill="currentColor" />
        </svg>
      </div>
      <div className="live-inactive__copy">
        <p className="eyebrow">{t.live.inactiveEyebrow}</p>
        <h2>{isPatient ? t.live.inactivePatientTitle : t.live.inactiveTherapistTitle}</h2>
        <p>{isPatient ? t.live.inactivePatientText : t.live.inactiveTherapistText}</p>
      </div>
    </section>
  )
}
