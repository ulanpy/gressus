import { useI18n } from '@/i18n/context'
import type { DashboardControlsProps } from '@/types/components'
import { Button } from '@/shared/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { controls, frameMeta } from '@/styles/ui'

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
      <ToggleGroup
        type="single"
        spacing={1}
        value={source}
        onValueChange={(next) => {
          if (next === 'mock' || next === 'live') setSource(next)
        }}
        className="inline-flex gap-1.5 rounded-2xl bg-slate-200/65 p-1"
      >
        <ToggleGroupItem
          value="mock"
          className="rounded-xl border-0 bg-transparent px-4 py-2.5 text-text-strong data-[state=on]:bg-slate-900 data-[state=on]:text-white data-[state=on]:shadow-[0_10px_26px_rgb(15_23_42/0.18)]"
        >
          {t.live.mock}
        </ToggleGroupItem>
        <ToggleGroupItem
          value="live"
          className="rounded-xl border-0 bg-transparent px-4 py-2.5 text-text-strong data-[state=on]:bg-slate-900 data-[state=on]:text-white data-[state=on]:shadow-[0_10px_26px_rgb(15_23_42/0.18)]"
        >
          {t.live.live}
        </ToggleGroupItem>
      </ToggleGroup>

      <Button type="button" variant="secondary" onClick={() => setShowSensors((value) => !value)}>
        {showSensors ? t.live.hideSensors : t.live.showSensors}
      </Button>

      <div className={frameMeta} />
    </section>
  )
}
