import { useI18n } from '../../i18n/context'
import type { PageTabsProps } from '../../types/components'
import { cn } from '../../lib/cn'
import { pillNav, pillNavButton, pillNavButtonActive } from '../../styles/ui'

export function PageTabs({ activeView, setActiveView }: PageTabsProps) {
  const { t } = useI18n()

  return (
    <nav
      className={cn(pillNav, 'm-0 max-sm:grid max-sm:grid-cols-3')}
      aria-label="Page view"
    >
      <button
        type="button"
        className={cn(
          pillNavButton,
          'max-sm:min-w-0',
          activeView === 'therapist' && pillNavButtonActive,
        )}
        onClick={() => setActiveView('therapist')}
      >
        {t.tabs.therapist}
      </button>
      <button
        type="button"
        className={cn(
          pillNavButton,
          'max-sm:min-w-0',
          activeView === 'patient' && pillNavButtonActive,
        )}
        onClick={() => setActiveView('patient')}
      >
        {t.tabs.patient}
      </button>
      <button
        type="button"
        className={cn(
          pillNavButton,
          'max-sm:min-w-0',
          activeView === 'control' && pillNavButtonActive,
        )}
        onClick={() => setActiveView('control')}
      >
        {t.tabs.control}
      </button>
    </nav>
  )
}
