import { memo } from 'react'
import { useI18n } from '../../i18n/context'
import type { PageTabsProps } from '../../types/components'
import { cn } from '../../lib/cn'
import { pillNav, pillNavButton, pillNavButtonActive } from '../../styles/ui'

export const PageTabs = memo(function PageTabs({ activeView, setActiveView }: PageTabsProps) {
  const { t } = useI18n()

  return (
    <nav
      className={cn(pillNav, 'm-0 max-sm:grid max-sm:grid-cols-2')}
      aria-label="Page view"
    >
      <button
        type="button"
        className={cn(pillNavButton, 'max-sm:min-w-0', activeView === 'game' && pillNavButtonActive)}
        onClick={() => setActiveView('game')}
      >
        {t.tabs.game}
      </button>
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
          activeView === 'control' && pillNavButtonActive,
        )}
        onClick={() => setActiveView('control')}
      >
        {t.tabs.control}
      </button>
      <button
        type="button"
        className={cn(
          pillNavButton,
          'max-sm:min-w-0',
          activeView === 'exoskeleton' && pillNavButtonActive,
        )}
        onClick={() => setActiveView('exoskeleton')}
      >
        {t.tabs.exoskeleton}
      </button>
    </nav>
  )
})
