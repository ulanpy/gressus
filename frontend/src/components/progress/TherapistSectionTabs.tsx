import { useI18n } from '../../i18n/context'
import { cn } from '../../lib/cn'
import { buttonGroup, buttonGroupItem, buttonGroupItemActive, container } from '../../styles/ui'
import type { TherapistSectionTabsProps } from '../../types/components'


export function TherapistSectionTabs({ activeSection, setActiveSection }: TherapistSectionTabsProps) {
  const { t } = useI18n()

  return (
    <section className={cn(container, 'flex mt-[30px]')} aria-label={t.therapist.progress}>
      <div className={buttonGroup}>
        <button
          type="button"
          className={cn(buttonGroupItem, activeSection === 'live' && buttonGroupItemActive)}
          onClick={() => setActiveSection('live')}
        >
          {t.therapist.live}
        </button>
        <button
          type="button"
          className={cn(buttonGroupItem, activeSection === 'progress' && buttonGroupItemActive)}
          onClick={() => setActiveSection('progress')}
        >
          {t.therapist.progress}
        </button>
      </div>
    </section>
  )
}
