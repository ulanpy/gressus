import type { FootDashboard } from '../../types/insole'
import { feetPanel, feetPanelPair, feetPanelSep } from '../../styles/ui'
import { FootHeatmap } from './FootHeatmap'


export function FeetPressurePanel({
  dashboard,
}: {
  dashboard: FootDashboard
}) {
  return (
    <article className={feetPanel} aria-label="Mock insole pressure maps">
      <div className={feetPanelPair}>
        <div className="px-7 py-6"><div className="foot-glow mx-auto max-w-[270px] [&_svg]:w-full [&_svg]:overflow-visible [&_svg]:drop-shadow-[0_22px_30px_rgb(15_23_42/0.14)]"><FootHeatmap frame={dashboard.leftFrame} scale={dashboard.dynamicScale} showSensors={false} silhouette={dashboard.leftSilhouette} idPrefix="therapist-left" title="Left insole pressure" /></div></div>
        <div className={feetPanelSep} aria-hidden />
        <div className="px-7 py-6"><div className="foot-glow mx-auto max-w-[270px] [&_svg]:w-full [&_svg]:overflow-visible [&_svg]:drop-shadow-[0_22px_30px_rgb(15_23_42/0.14)]"><FootHeatmap frame={dashboard.rightFrame} scale={dashboard.dynamicScale} showSensors={false} silhouette={dashboard.rightSilhouette} idPrefix="therapist-right" title="Right insole pressure" /></div></div>
      </div>
    </article>
  )
}
