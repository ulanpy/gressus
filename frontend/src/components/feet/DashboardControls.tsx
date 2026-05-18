import { useI18n } from '../../i18n/context'
import type { DashboardControlsProps } from '../../types/components'


export function DashboardControls({
  frame,
  setShowSensors,
  setSource,
  showSensors,
  source,
}: DashboardControlsProps) {
  const { t } = useI18n()

  return (
    <section className="controls" aria-label={t.live.source}>
      <div className="button-group">
        <button type="button" className={source === 'mock' ? 'active' : ''} onClick={() => setSource('mock')}>
          {t.live.mock}
        </button>
        <button type="button" className={source === 'live' ? 'active' : ''} onClick={() => setSource('live')}>
          {t.live.live}
        </button>
      </div>

      <button type="button" className="ghost" onClick={() => setShowSensors((value) => !value)}>
        {showSensors ? t.live.hideSensors : t.live.showSensors}
      </button>

      <div className="frame-meta">
        seq {frame?.seq ?? '-'} / dt {frame?.dtMs ?? '-'} мс / age{' '}
        {frame?.ageS == null ? '-' : `${frame.ageS.toFixed(2)}с`}
      </div>
    </section>
  )
}
