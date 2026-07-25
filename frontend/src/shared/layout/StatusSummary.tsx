import { useI18n } from '../../i18n/context'
import { translateStatus } from '../../lib/i18nText'
import type { StatusSummaryProps } from '../../types/components'
import { cn } from '@/shared/lib/utils'
import { panel } from '../../styles/ui'

export function StatusSummary({ dynamicScale, source, status }: StatusSummaryProps) {
  const { t } = useI18n()

  return (
    <div className="grid gap-3">
      <div className={cn(panel, 'rounded-[22px] p-[18px]')}>
        <span className="text-xs tracking-[0.08em] text-muted uppercase">{t.live.source}</span>
        <strong className="mt-1.5 block text-[22px] text-text-strong">
          {source === 'mock' ? t.live.mockGait : t.live.liveTcp}
        </strong>
      </div>
      <div className={cn(panel, 'rounded-[22px] p-[18px]')}>
        <span className="text-xs tracking-[0.08em] text-muted uppercase">{t.live.socket}</span>
        <strong className="mt-1.5 block text-[22px] text-text-strong">
          {translateStatus(status, t)}
        </strong>
      </div>
      <div className={cn(panel, 'rounded-[22px] p-[18px]')}>
        <span className="text-xs tracking-[0.08em] text-muted uppercase">{t.live.scale}</span>
        <strong className="mt-1.5 block text-[22px] text-text-strong">
          {Math.round(dynamicScale)} {t.live.kpa}
        </strong>
      </div>
    </div>
  )
}
