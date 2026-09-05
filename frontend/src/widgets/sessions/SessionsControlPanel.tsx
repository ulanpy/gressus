import { useEffect, useState } from 'react'
import { Circle, CircleStop, Crosshair, Gamepad2, Settings2, UserRound } from 'lucide-react'
import type { PatientSessionWorkflow } from '@/hooks/usePatientSessionWorkflow'
import { useRuntimeStatus } from '@/hooks/useRuntimeStatus'
import { startRecordingSession, startRuntimeActivity, stopRecordingSession, stopRuntimeActivity, type RuntimeActivityKind } from '@/lib/api/runtime'
import { INSOLE_SIZE } from '@/constants/insole'
import { useGeometry } from '@/hooks/useGeometry'
import { useInsoleFrame } from '@/hooks/useInsoleFrame'
import { useFootDashboard } from '@/hooks/useFootDashboard'
import { useI18n } from '@/i18n/context'
import { FootHeatmap } from '@/widgets/feet/FootHeatmap'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/shared/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

const DEFAULT_GAME = { display: '0', outputRotation: 90, insoleThresholdKpa: 8, speed: 2.5, stepTimeS: 0.9 }
const DEFAULT_CALIBRATION = { width: 640, height: 480, fps: 30, tagSize: 280, margin: 30 }
type GameMode = 'full' | 'camera' | 'demo'

function PresetSelect({ label, value, options, onChange }: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return <label className="grid gap-1.5 text-xs font-medium text-slate-600">
    {label}
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
  </label>
}

function SourceStatus({ label, online }: { label: string; online: boolean }) {
  return <span className="inline-flex items-center gap-1.5 text-sm text-slate-600" aria-label={`${label}: ${online ? 'online' : 'offline'}`}>
    <span className={`size-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-300'}`} />{label}
  </span>
}

export function SessionsControlPanel({ workflow }: { workflow: PatientSessionWorkflow }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gameMode, setGameMode] = useState<GameMode>('full')
  const [game, setGame] = useState(DEFAULT_GAME)
  const [calibration, setCalibration] = useState(DEFAULT_CALIBRATION)
  const { geometry, setStatus } = useGeometry(INSOLE_SIZE)
  const { frame } = useInsoleFrame('live', INSOLE_SIZE, setStatus, true)
  const dashboard = useFootDashboard(geometry, frame)
  const { snapshot: runtime } = useRuntimeStatus(true)
  const activeSession = workflow.activeSession
  const activity = runtime?.activity?.activeJob ?? null
  const insoleConnected = frame?.connected === true && frame.available === true
  const pgearConnected = runtime?.pgear.connected === true
  const activityLabel = activity?.name === 'calibration' ? t.sessions.calibration : activity?.name === 'game' ? t.sessions.game : null

  useEffect(() => {
    if (!activeSession || !workflow.selectedPatientId) return
    void workflow.refreshSessions()
  }, [activeSession?.id, workflow.selectedPatientId])

  const startSession = async () => {
    if (!workflow.selectedPatient) {
      setError(t.sessions.selectPatient)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await startRecordingSession({ patientId: workflow.selectedPatient.id })
      await workflow.refreshSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.sessions.startFailed)
    } finally {
      setBusy(false)
    }
  }

  const endSession = async () => {
    setBusy(true)
    setError(null)
    try {
      await stopRecordingSession()
      await workflow.refreshSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.sessions.endFailed)
    } finally {
      setBusy(false)
    }
  }

  const startActivity = async (kind: RuntimeActivityKind) => {
    if (!activeSession) return
    setBusy(true)
    setError(null)
    try {
      const params = kind === 'calibration'
        ? { camera: 'realsense', ...calibration, display: game.display, outputRotation: game.outputRotation }
        : { mode: gameMode === 'full' ? 'existing_insole' : gameMode, ...game }
      await startRuntimeActivity({ kind, params, ownerSessionId: activeSession.id })
    } catch (err) {
      setError(err instanceof Error ? err.message : t.sessions.processFailed)
    } finally {
      setBusy(false)
    }
  }

  const stopActivity = async () => {
    setBusy(true)
    setError(null)
    try {
      await stopRuntimeActivity()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.sessions.stopFailed)
    } finally {
      setBusy(false)
    }
  }

  const displays = [0, 1, 2, 3, 4].map((value) => ({ value: String(value), label: `${t.sessions.display} ${value}` }))
  const rotations = [0, 90, 180, 270].map((value) => ({ value: String(value), label: `${value}°` }))

  return <div className="mx-auto grid w-full max-w-4xl gap-4 text-slate-900">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="m-0 text-2xl font-bold tracking-tight">{t.sessions.title}</h1>
      {activeSession ? <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{t.sessions.active}</Badge> : null}
    </div>

    <Card className="gap-0 py-0 shadow-panel">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
        <label className="grid min-w-56 gap-1 text-xs font-medium text-slate-500">
          {t.sessions.patient}
          <Select value={workflow.selectedPatientId ?? undefined} onValueChange={workflow.selectPatient} disabled={busy || Boolean(activeSession)}>
            <SelectTrigger className="h-auto w-full border-0 px-0 py-0 text-base font-semibold text-slate-900 shadow-none"><UserRound className="size-4" /><SelectValue placeholder={t.sessions.selectPatient} /></SelectTrigger>
            <SelectContent>{workflow.patients.map((patient) => <SelectItem key={patient.id} value={patient.id}>{patient.display_name}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <div className="flex items-center gap-3">
          <SourceStatus label={t.sessions.insole} online={insoleConnected} />
          <SourceStatus label={t.sessions.pgear} online={pgearConnected} />
          <div className="ml-1 flex items-end -space-x-2" aria-label={t.sessions.insole}>
            <div className="w-9"><FootHeatmap frame={dashboard.leftFrame} scale={dashboard.dynamicScale} showSensors={false} silhouette={dashboard.leftSilhouette} idPrefix="sessions-left" title="" /></div>
            <div className="w-9"><FootHeatmap frame={dashboard.rightFrame} scale={dashboard.dynamicScale} showSensors={false} silhouette={dashboard.rightSilhouette} idPrefix="sessions-right" title="" /></div>
          </div>
        </div>
      </CardContent>
    </Card>

    {!activeSession ? <Card className="gap-0 py-0 shadow-panel"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div><h2 className="m-0 text-base font-bold">{t.sessions.startTitle}</h2><p className="m-0 mt-1 text-sm text-slate-500">{t.sessions.startDescription}</p></div>
      <Button type="button" size="lg" disabled={busy || workflow.loading || !workflow.selectedPatient} onClick={() => void startSession()}><Circle className="size-3.5" fill="currentColor" /> {t.sessions.start}</Button>
    </CardContent></Card> : <Card className="gap-0 py-0 shadow-panel"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div><h2 className="m-0 text-base font-bold">{t.sessions.activeTitle}</h2><p className="m-0 mt-1 text-sm text-slate-500">{t.sessions.activeDescription}</p></div>
      <Button type="button" size="lg" variant="destructive" disabled={busy} onClick={() => void endSession()}><CircleStop className="size-5" /> {t.sessions.end}</Button>
    </CardContent></Card>}

    {activeSession ? <Card className="gap-0 py-0 shadow-panel"><CardContent className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="m-0 text-base font-bold">{t.sessions.game}</h2><p className="m-0 mt-1 text-sm text-slate-500">{t.sessions.gameDescription}</p></div>
        {activityLabel ? <Badge variant="outline">{activityLabel}</Badge> : null}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 p-4">
          <p className="m-0 text-sm font-semibold">{t.sessions.gameLaunch}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select value={gameMode} onValueChange={(value) => setGameMode(value as GameMode)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="full">{t.sessions.modeFull}</SelectItem><SelectItem value="camera">{t.sessions.modeCamera}</SelectItem><SelectItem value="demo">{t.sessions.modeDemo}</SelectItem></SelectContent></Select>
            <Button type="button" disabled={busy || Boolean(activity) || (gameMode === 'full' && !insoleConnected)} onClick={() => void startActivity('game')}><Gamepad2 className="size-4" /> {t.sessions.launch}</Button>
            <Popover><PopoverTrigger asChild><Button type="button" size="icon" variant="ghost" aria-label={t.sessions.gameSettings}><Settings2 className="size-4" /></Button></PopoverTrigger><PopoverContent align="end"><PopoverHeader><PopoverTitle>{t.sessions.gameSettings}</PopoverTitle></PopoverHeader><div className="mt-4 grid gap-3"><PresetSelect label={t.sessions.display} value={game.display} onChange={(value) => setGame((prev) => ({ ...prev, display: value }))} options={displays} /><PresetSelect label={t.sessions.rotation} value={String(game.outputRotation)} onChange={(value) => setGame((prev) => ({ ...prev, outputRotation: Number(value) }))} options={rotations} /><PresetSelect label={t.sessions.speed} value={String(game.speed)} onChange={(value) => setGame((prev) => ({ ...prev, speed: Number(value) }))} options={['1.5', '2.0', '2.5', '3.0'].map((value) => ({ value, label: value }))} /><PresetSelect label={t.sessions.interval} value={String(game.stepTimeS)} onChange={(value) => setGame((prev) => ({ ...prev, stepTimeS: Number(value) }))} options={['0.7', '0.9', '1.2', '1.5'].map((value) => ({ value, label: `${value} с` }))} /><PresetSelect label={t.sessions.threshold} value={String(game.insoleThresholdKpa)} onChange={(value) => setGame((prev) => ({ ...prev, insoleThresholdKpa: Number(value) }))} options={['5', '8', '10', '12'].map((value) => ({ value, label: `${value} kPa` }))} /></div></PopoverContent></Popover>
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 p-4">
          <p className="m-0 text-sm font-semibold">{t.sessions.calibration}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" disabled={busy || Boolean(activity)} onClick={() => void startActivity('calibration')}><Crosshair className="size-4" /> {t.sessions.launch}</Button>
            <Popover><PopoverTrigger asChild><Button type="button" size="icon" variant="ghost" aria-label={t.sessions.calibrationSettings}><Settings2 className="size-4" /></Button></PopoverTrigger><PopoverContent align="start"><PopoverHeader><PopoverTitle>{t.sessions.calibrationSettings}</PopoverTitle></PopoverHeader><div className="mt-4 grid gap-3"><PresetSelect label={t.sessions.display} value={game.display} onChange={(value) => setGame((prev) => ({ ...prev, display: value }))} options={displays} /><PresetSelect label={t.sessions.rotation} value={String(game.outputRotation)} onChange={(value) => setGame((prev) => ({ ...prev, outputRotation: Number(value) }))} options={rotations} /><PresetSelect label={t.sessions.camera} value={`${calibration.width}x${calibration.height}`} onChange={(value) => { const [width, height] = value.split('x').map(Number); setCalibration((prev) => ({ ...prev, width, height })) }} options={[['640x480', '640 × 480'], ['848x480', '848 × 480'], ['1280x720', '1280 × 720']].map(([value, label]) => ({ value, label }))} /><PresetSelect label={t.sessions.fps} value={String(calibration.fps)} onChange={(value) => setCalibration((prev) => ({ ...prev, fps: Number(value) }))} options={['15', '30', '60'].map((value) => ({ value, label: value }))} /><PresetSelect label={t.sessions.tagSize} value={String(calibration.tagSize)} onChange={(value) => setCalibration((prev) => ({ ...prev, tagSize: Number(value) }))} options={['240', '280', '320'].map((value) => ({ value, label: `${value} px` }))} /><PresetSelect label={t.sessions.margin} value={String(calibration.margin)} onChange={(value) => setCalibration((prev) => ({ ...prev, margin: Number(value) }))} options={['20', '30', '40'].map((value) => ({ value, label: `${value} px` }))} /></div></PopoverContent></Popover>
          </div>
        </section>
      </div>
      {activity ? <Button type="button" className="mt-4" variant="destructive" disabled={busy} onClick={() => void stopActivity()}><CircleStop className="size-4" /> {t.sessions.stop}</Button> : null}
    </CardContent></Card> : null}

    {error ? <p className="m-0 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
  </div>
}
