import { useI18n } from '../../i18n/context'
import type { TherapistSectionTabsProps } from '../../types/components'


export function TherapistSectionTabs({ activeSection, setActiveSection }: TherapistSectionTabsProps) {
  const { t } = useI18n()

  return (
    <section className="therapist-section-tabs" aria-label={t.therapist.progress}>
      <div className="button-group">
        <button
          type="button"
          className={activeSection === 'live' ? 'active' : ''}
          onClick={() => setActiveSection('live')}
        >
          {t.therapist.live}
        </button>
        <button
          type="button"
          className={activeSection === 'progress' ? 'active' : ''}
          onClick={() => setActiveSection('progress')}
        >
          {t.therapist.progress}
        </button>
      </div>
    </section>
  )
}
