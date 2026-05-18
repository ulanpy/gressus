import { useI18n } from '../../i18n/context'
import { translateStatus } from '../../lib/i18nText'
import type { StatusSummaryProps } from '../../types/components'


export function StatusSummary({ dynamicScale, source, status }: StatusSummaryProps) {
  const { t } = useI18n()

  return (
    <div className="status-grid">
      <div className="status-card">
        <span>{t.live.source}</span>
        <strong>{source === 'mock' ? t.live.mockGait : t.live.liveTcp}</strong>
      </div>
      <div className="status-card">
        <span>{t.live.socket}</span>
        <strong>{translateStatus(status, t)}</strong>
      </div>
      <div className="status-card">
        <span>{t.live.scale}</span>
        <strong>
          {Math.round(dynamicScale)} {t.live.kpa}
        </strong>
      </div>
    </div>
  )
}
