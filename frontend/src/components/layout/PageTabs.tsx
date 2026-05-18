import { useI18n } from '../../i18n/context'
import type { PageTabsProps } from '../../types/components'


export function PageTabs({ activeView, setActiveView }: PageTabsProps) {
  const { t } = useI18n()

  return (
    <nav className="page-tabs" aria-label="Page view">
      <button
        type="button"
        className={activeView === 'therapist' ? 'active' : ''}
        onClick={() => setActiveView('therapist')}
      >
        {t.tabs.therapist}
      </button>
      <button
        type="button"
        className={activeView === 'patient' ? 'active' : ''}
        onClick={() => setActiveView('patient')}
      >
        {t.tabs.patient}
      </button>
      <button
        type="button"
        className={activeView === 'control' ? 'active' : ''}
        onClick={() => setActiveView('control')}
      >
        {t.tabs.control}
      </button>
    </nav>
  )
}
