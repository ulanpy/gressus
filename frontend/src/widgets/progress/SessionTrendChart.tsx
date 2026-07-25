import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useI18n } from '../../i18n/context'
import { tooltipStyle } from '../../constants/charts'
import { cn } from '@/shared/lib/utils'
import { progressCard } from '../../styles/ui'
import type { ChartProps } from '../../types/components'
import { CardHeading } from '@/shared/layout/CardHeading'


export function SessionTrendChart({ metrics }: ChartProps) {
  const { t } = useI18n()

  return (
    <article className={cn(progressCard, 'min-h-[390px] max-[640px]:min-h-[340px]')}>
      <CardHeading eyebrow={t.progress.charts.sessionTrend} title={t.progress.charts.scoreTrajectory} />
      <div className="h-[300px] max-[640px]:h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={metrics} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgb(226 232 240)" vertical={false} />
            <XAxis dataKey="session" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis domain={[50, 90]} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend iconType="circle" wrapperStyle={{ color: '#64748b', fontSize: 12 }} />
            <Line type="monotone" dataKey="gaitScore" name={t.progress.charts.gait} stroke="#0891b2" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="symmetryScore" name={t.progress.charts.symmetry} stroke="#2563eb" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="stabilityScore" name={t.progress.charts.stability} stroke="#10b981" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}
