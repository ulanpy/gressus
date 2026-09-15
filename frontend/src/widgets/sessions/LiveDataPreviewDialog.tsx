import { Activity } from 'lucide-react'
import { useEmgPreview, type EmgPreviewChannel } from '@/hooks/useEmgPreview'
import { useExoskeletonTelemetry } from '@/hooks/useExoskeletonTelemetry'
import { INSOLE_SIZE } from '@/constants/insole'
import { useGeometry } from '@/hooks/useGeometry'
import { useInsoleFrame } from '@/hooks/useInsoleFrame'
import { useFootDashboard } from '@/hooks/useFootDashboard'
import { FootHeatmap } from '@/widgets/feet/FootHeatmap'
import { LiveJointTelemetryChart } from '@/widgets/exoskeleton/LiveJointTelemetryChart'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'

function PressurePreview() {
  const { geometry, setStatus } = useGeometry(INSOLE_SIZE)
  const { frame } = useInsoleFrame('live', INSOLE_SIZE, setStatus, true)
  const dashboard = useFootDashboard(geometry, frame)

  return <div className="grid gap-4"><p className="m-0 text-sm text-slate-500">Карта обновляется максимум 10 раз в секунду. Это preview потока, запись сеанса не меняется.</p><div className="grid grid-cols-2 gap-5 rounded-2xl bg-slate-50 p-5"><div><p className="m-0 mb-2 text-center text-sm font-bold text-slate-600">Левая</p><FootHeatmap frame={dashboard.leftFrame} scale={dashboard.dynamicScale} showSensors silhouette={dashboard.leftSilhouette} idPrefix="pressure-preview-left" title="Карта давления левой стельки" /></div><div><p className="m-0 mb-2 text-center text-sm font-bold text-slate-600">Правая</p><FootHeatmap frame={dashboard.rightFrame} scale={dashboard.dynamicScale} showSensors silhouette={dashboard.rightSilhouette} idPrefix="pressure-preview-right" title="Карта давления правой стельки" /></div></div></div>
}

function channelPoints(samples: number[]) {
  if (samples.length < 2) return ''
  const min = Math.min(...samples)
  const max = Math.max(...samples)
  const span = max - min || 1
  return samples.map((value, index) => `${(index / (samples.length - 1)) * 100},${100 - ((value - min) / span) * 100}`).join(' ')
}

function EmgChannelPlot({ channel }: { channel: EmgPreviewChannel }) {
  return <article className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"><div className="flex items-center justify-between text-[11px] font-bold text-slate-600"><span>slot_{channel.slot}</span><span>{channel.samples.length} pts</span></div><svg className="mt-1 h-12 w-full" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`EMG slot ${channel.slot}`}><path d="M0 50H100" stroke="rgb(203 213 225)" strokeWidth="2" vectorEffect="non-scaling-stroke" /><polyline points={channelPoints(channel.samples)} fill="none" stroke="rgb(14 116 144)" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg></article>
}

function EmgPreview() {
  const { frame, status } = useEmgPreview()
  const channels = frame?.channels ?? []
  return <div className="grid gap-4"><div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="font-semibold">Preview: {status}</span>{frame?.sampleRateHz ? <span className="text-slate-500">Источник {frame.sampleRateHz} Hz · в UI 10 Hz</span> : null}</div><p className="m-0 text-sm text-slate-500">Графики — прореженный preview по слотам. Полные 2 kHz данные остаются в ROS/rosbag и не передаются в браузер.</p>{channels.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{channels.map((channel) => <EmgChannelPlot key={channel.slot} channel={channel} />)}</div> : <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-500"><Activity className="mb-2 size-5" />Ожидание EMG-кадра</div>}</div>
}

function PgearPreview() {
  const { history, status } = useExoskeletonTelemetry(true)
  return <div className="grid gap-4"><p className="m-0 text-sm text-slate-500">Telemetry обновляется в UI с ограничением 5 Hz и хранит только последние 30 секунд.</p><div className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold">Preview: {status}</div><LiveJointTelemetryChart history={history} /></div>
}

type LiveDataPreviewDialogProps = {
  kind: 'pressure' | 'emg' | 'pgear'
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LiveDataPreviewDialog({ kind, open, onOpenChange }: LiveDataPreviewDialogProps) {
  const pressure = kind === 'pressure'
  const title = pressure ? 'Давление стелек: live preview' : kind === 'emg' ? 'EMG: live preview' : 'P.GEAR: live telemetry'
  const description = pressure ? 'Проверка входящих данных со стелек.' : kind === 'emg' ? 'Проверка входящих EMG-каналов без передачи raw-потока на frontend.' : 'Проверка входящей телеметрии экзоскелета.'
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[min(88vh,760px)] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{open && (pressure ? <PressurePreview /> : kind === 'emg' ? <EmgPreview /> : <PgearPreview />)}</DialogContent></Dialog>
}
