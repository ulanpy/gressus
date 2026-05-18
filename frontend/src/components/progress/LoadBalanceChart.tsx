import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useI18n } from '../../i18n/context'
import { tooltipStyle } from '../../constants/charts'
import type { ChartProps } from '../../types/components'
import { CardHeading } from '../layout/CardHeading'


export function LoadBalanceChart({ metrics }: ChartProps) {
  const { t } = useI18n()

  return (
    <article className="progress-card chart-card">
      <CardHeading eyebrow={t.progress.charts.loadBalance} title={t.progress.charts.avgPressure} />
      <div className="chart-shell">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={metrics} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgb(226 232 240)" vertical={false} />
            <XAxis dataKey="session" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} unit=" kPa" />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend iconType="circle" wrapperStyle={{ color: '#64748b', fontSize: 12 }} />
            <Bar dataKey="leftAvgPressure" name={t.progress.charts.left} fill="#38bdf8" radius={[8, 8, 0, 0]} />
            <Bar dataKey="rightAvgPressure" name={t.progress.charts.right} fill="#34d399" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}
