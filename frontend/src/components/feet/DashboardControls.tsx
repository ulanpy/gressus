import { cn } from '../../lib/cn'
import { useI18n } from '../../i18n/context'
import type { DashboardControlsProps } from '../../types/components'
import {
  buttonGroup,
  buttonGroupItem,
  buttonGroupItemActive,
  controls,
  frameMeta,
  ghostButton,
} from '../../styles/ui'


export function DashboardControls({
  frame: _frame,
  setShowSensors,
  setSource,
  showSensors,
  source,
}: DashboardControlsProps) {
  const { t } = useI18n()

  return (
    <section className={controls} aria-label={t.live.source}>
      <div className={buttonGroup}>
        <button
          type="button"
          className={cn(buttonGroupItem, 'px-3', source === 'mock' && buttonGroupItemActive)}
          onClick={() => setSource('mock')}
        >
          {t.live.mock}
        </button>
        <button
          type="button"
          className={cn(buttonGroupItem, 'px-3', source === 'live' && buttonGroupItemActive)}
          onClick={() => setSource('live')}
        >
          {t.live.live}
        </button>
      </div>

      <button type="button" className={ghostButton} onClick={() => setShowSensors((value) => !value)}>
        {showSensors ? t.live.hideSensors : t.live.showSensors}
      </button>

      <div className={frameMeta}>
        {/* seq {frame?.seq ?? '-'} / dt {frame?.dtMs ?? '-'} мс / age{' '} */}
        {/* {frame?.ageS == null ? '-' : `${frame.ageS.toFixed(2)}с`} */}
      </div>
    </section>
  )
}
