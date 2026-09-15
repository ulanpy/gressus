import { useEffect, useState, type ReactNode } from 'react'
import { Activity, ChartLine, CircleStop, Clock3, Crosshair, Footprints, Gamepad2, MonitorUp, Play, Settings2, ShieldCheck, UserRound } from 'lucide-react'
import type { PatientSessionWorkflow } from '@/hooks/usePatientSessionWorkflow'
import { useRuntimeStatus } from '@/hooks/useRuntimeStatus'
import { startRecordingSession, startRuntimeActivity, stopRecordingSession, stopRuntimeActivity, type RuntimeActivityKind } from '@/lib/api/runtime'
import { useI18n } from '@/i18n/context'
import { formatDateOnly } from '@/lib/format'
import { LiveDataPreviewDialog } from '@/widgets/sessions/LiveDataPreviewDialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

const DEFAULT_GAME = { display: '0', outputRotation: 90, insoleThresholdKpa: 8, speed: 2.5, stepTimeS: 0.9 }
const DEFAULT_CALIBRATION = { width: 640, height: 480, fps: 30, tagSize: 280, margin: 30 }
type GameMode = 'full' | 'camera' | 'demo'

function Field({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-xs font-medium text-slate-600">{label}<Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></label>
}

function EquipmentCard({ icon: Icon, title, detail, connected, preview, action }: { icon: typeof Footprints; title: string; detail: string; connected?: boolean; preview?: ReactNode; action?: ReactNode }) {
  return <Card className="relative min-h-[192px] gap-0 overflow-hidden border-slate-200 py-0 shadow-sm">
    <CardContent className="flex h-full flex-col p-4"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600"><Icon className="size-6" /></span><div className="flex h-14 min-w-0 flex-col justify-center gap-1.5"><h3 className="m-0 whitespace-nowrap text-sm font-bold">{title}</h3>{connected !== undefined ? <Badge variant="outline" className={`w-fit ${connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}><span className={`size-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />{connected ? 'Подключено' : 'Нет связи'}</Badge> : null}</div></div>{preview}</div><p className="m-0 mt-5 text-sm leading-5 text-slate-500">{detail}</p>{action ? <div className="mt-auto pt-4">{action}</div> : null}</CardContent>
  </Card>
}

function formatElapsedTime(startedAt: string | null, now: number) {
  if (!startedAt) return '—'
  const startedAtMs = new Date(startedAt).getTime()
  if (!Number.isFinite(startedAtMs)) return '—'

  const elapsedSeconds = Math.max(0, Math.floor((now - startedAtMs) / 1000))
  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

export function SessionsControlPanel({ workflow }: { workflow: PatientSessionWorkflow }) {
  const { t, language } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startOpen, setStartOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pressurePreviewOpen, setPressurePreviewOpen] = useState(false)
  const [emgPreviewOpen, setEmgPreviewOpen] = useState(false)
  const [pgearPreviewOpen, setPgearPreviewOpen] = useState(false)
  const [startPatientId, setStartPatientId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [gameMode, setGameMode] = useState<GameMode>('full')
  const [game, setGame] = useState(DEFAULT_GAME)
  const [calibration, setCalibration] = useState(DEFAULT_CALIBRATION)
  const { snapshot: runtime } = useRuntimeStatus(true)
  const activeSession = workflow.activeRecordingSession
  const activeSessionPatient = activeSession
    ? workflow.patients.find((patient) => patient.id === activeSession.patient_id) ?? null
    : null
  const preparedPatient = workflow.selectedPatient
  const lastSession = workflow.sessions.find((session) => session.status !== 'active') ?? null
  const activeJob = runtime?.activity.activeJob ?? null
  const insoleConnected = runtime?.insoles.connected === true
  const emgConnected = runtime?.emg.connected === true
  const pgearConnected = runtime?.pgear.connected === true
  const activeJobLabel = activeJob?.name === 'calibration' ? t.sessions.calibration : activeJob?.name === 'game' ? t.sessions.game : null
  const displays = [0, 1, 2, 3, 4].map((value) => ({ value: String(value), label: `${t.sessions.display} ${value}` }))
  const rotations = [0, 90, 180, 270].map((value) => ({ value: String(value), label: `${value}°` }))

  useEffect(() => { void workflow.refreshActiveRecordingSession() }, [workflow.refreshActiveRecordingSession])
  useEffect(() => { if (activeSession?.patient_id === workflow.selectedPatientId) void workflow.refreshSessions() }, [activeSession?.id, activeSession?.patient_id, workflow.selectedPatientId, workflow.refreshSessions])
  useEffect(() => {
    if (!activeSession?.started_at) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [activeSession?.started_at])

  const run = async (task: () => Promise<void>) => { setBusy(true); setError(null); try { await task() } catch (err) { setError(err instanceof Error ? err.message : t.sessions.processFailed) } finally { setBusy(false) } }
  const openStartDialog = () => { setStartPatientId(workflow.selectedPatientId); setStartOpen(true) }
  const choosePatient = () => { if (!startPatientId) { setError(t.sessions.selectPatient); return }; workflow.selectPatient(startPatientId); setStartOpen(false) }
  const startSession = () => run(async () => { if (!preparedPatient) throw new Error(t.sessions.selectPatient); await startRecordingSession({ patientId: preparedPatient.id }); await workflow.refreshActiveRecordingSession() })
  const endSession = () => run(async () => { await stopRecordingSession(); await workflow.refreshActiveRecordingSession(); if (activeSession?.patient_id === workflow.selectedPatientId) await workflow.refreshSessions() })
  const startActivity = (kind: RuntimeActivityKind) => run(async () => { if (!activeSession) return; const params = kind === 'calibration' ? { camera: 'realsense', ...calibration, display: game.display, outputRotation: game.outputRotation } : { mode: gameMode === 'full' ? 'existing_insole' : gameMode, ...game }; await startRuntimeActivity({ kind, params, ownerSessionId: activeSession.id }) })
  const stopActivity = () => run(async () => { await stopRuntimeActivity() })

  const gameAction = activeJob?.name === 'game'
    ? { label: 'Остановить игру', icon: CircleStop, onClick: stopActivity, variant: 'destructive' as const }
    : { label: 'Начать игру', icon: Gamepad2, onClick: () => startActivity('game'), variant: 'default' as const }
  const GameActionIcon = gameAction.icon
  const gameBlockedReason = !activeSession
    ? 'Игра будет доступна после начала сеанса.'
    : activeJob
      ? 'Сначала остановите текущее действие.'
      : gameMode === 'full' && !insoleConnected
        ? 'Подключите стельки или выберите другой режим в настройках.'
        : null

  return <main className="mx-auto w-full max-w-6xl text-slate-900">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-sky-50/70 p-4 shadow-sm"><div className="min-w-0"><p className="m-0 inline-flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-slate-500 uppercase"><span className={`size-2 rounded-full ${activeSession ? 'bg-sky-600' : preparedPatient ? 'bg-amber-500' : 'bg-slate-400'}`} aria-hidden="true" />{activeSession ? 'Сеанс идёт' : preparedPatient ? 'Подготовка' : 'Не начат'}</p><h1 className="m-0 mt-1 text-2xl font-bold tracking-tight">{activeSession ? activeSession.title ?? `Сеанс ${activeSession.session_number ?? '—'}` : preparedPatient ? preparedPatient.display_name : 'Новая сессия'}</h1>{activeSession ? <p className="m-0 mt-1 text-sm text-slate-600">{activeSessionPatient?.display_name ?? 'Пациент'}<span className="px-1.5 text-slate-400">·</span>Сеанс №{activeSession.session_number ?? '—'}</p> : preparedPatient ? <p className="m-0 mt-1 text-sm text-slate-600">{lastSession?.session_date ? `Последний сеанс: ${formatDateOnly(lastSession.session_date, language)}` : 'Пациент выбран, можно начинать.'}</p> : <p className="m-0 mt-1 text-sm text-slate-600">Выберите пациента для подготовки сеанса.</p>}</div>{activeSession ? <div className="flex flex-wrap items-center gap-3"><div className="inline-flex h-24 min-w-[18rem] items-center gap-3 rounded-2xl border border-sky-300 bg-white px-5 text-sky-950 shadow-sm" aria-live="polite"><Clock3 className="size-7 text-sky-700" /><div className="grid leading-none"><span className="text-xs font-bold tracking-[0.12em] text-sky-700 uppercase">Время записи</span><span className="mt-2 text-5xl font-extrabold tracking-wide tabular-nums">{formatElapsedTime(activeSession.started_at, now)}</span></div></div><Button type="button" size="lg" className="h-16 rounded-2xl px-7 text-lg font-bold" variant="destructive" disabled={busy} onClick={endSession}><CircleStop className="size-6" />{t.sessions.end}</Button></div> : preparedPatient ? <div className="flex items-center gap-2"><Button type="button" variant="outline" disabled={busy} onClick={openStartDialog}>Изменить</Button><Button type="button" size="lg" className="h-14 rounded-2xl px-7 text-lg font-bold" disabled={busy || workflow.loading} onClick={startSession}><Play className="size-4" fill="currentColor" />Начать сеанс</Button></div> : <Button type="button" size="lg" className="h-14 rounded-2xl px-7 text-lg font-bold" disabled={busy || workflow.loading} onClick={openStartDialog}><UserRound className="size-5" />Выбрать пациента</Button>}</header>

    <section className="mt-5"><h2 className="m-0 mb-2 text-lg font-bold">Оборудование</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><EquipmentCard icon={Footprints} title={t.sessions.insole} connected={insoleConnected} detail="Запись начинается автоматически." preview={<Button type="button" size="icon-sm" variant="outline" aria-label="Открыть график давления стелек" title="Открыть график давления" onClick={() => setPressurePreviewOpen(true)}><ChartLine className="size-4" /></Button>} /><EquipmentCard icon={Activity} title="EMG" connected={emgConnected} detail="Сигнал записывается автоматически. В интерфейсе — превью." preview={<Button type="button" size="icon-sm" variant="outline" aria-label="Открыть графики EMG" title="Открыть графики EMG" onClick={() => setEmgPreviewOpen(true)}><ChartLine className="size-4" /></Button>} /><EquipmentCard icon={ShieldCheck} title="P.GEAR" connected={pgearConnected} detail="Управляется на самом устройстве." preview={<Button type="button" size="icon-sm" variant="outline" aria-label="Открыть телеметрию P.GEAR" title="Открыть телеметрию" onClick={() => setPgearPreviewOpen(true)}><ChartLine className="size-4" /></Button>} /><EquipmentCard icon={MonitorUp} title="Камера и проектор" detail={activeJobLabel ? 'Действие выполняется для текущего сеанса.' : activeSession ? 'Настройте параметры или начните игру.' : 'Доступно после начала сеанса.'} action={activeSession ? <div className="grid gap-2"><div className="flex gap-2"><Button type="button" className="flex-1" variant={gameAction.variant} disabled={busy || Boolean(gameBlockedReason)} onClick={gameAction.onClick}><GameActionIcon className="size-4" />{gameAction.label}</Button><Button type="button" size="icon" variant="outline" aria-label="Настройки камеры и игры" title="Настройки камеры и игры" onClick={() => setSettingsOpen(true)}><Settings2 className="size-4" /></Button></div>{gameBlockedReason ? <p className="m-0 text-xs leading-4 text-slate-500">{gameBlockedReason}</p> : null}</div> : null} /></div></section>
    {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}

    <Dialog open={startOpen} onOpenChange={(open) => !busy && setStartOpen(open)}><DialogContent className="gap-6 p-8 sm:max-w-xl"><DialogHeader className="gap-3"><DialogTitle className="text-2xl">Выбор пациента</DialogTitle><DialogDescription className="text-base">После выбора можно проверить оборудование и начать сеанс.</DialogDescription></DialogHeader><div className="grid gap-3"><Label className="text-base font-bold">Пациент</Label><Select value={startPatientId ?? undefined} onValueChange={setStartPatientId} disabled={busy}><SelectTrigger className="h-14 w-full px-5 text-lg"><UserRound className="size-5" /><SelectValue placeholder={t.sessions.selectPatient} /></SelectTrigger><SelectContent position="popper" className="w-[var(--radix-select-trigger-width)]">{workflow.patients.map((patient) => <SelectItem key={patient.id} className="py-3 text-lg" value={patient.id}>{patient.display_name}</SelectItem>)}</SelectContent></Select></div><DialogFooter className="gap-3"><Button type="button" variant="outline" className="h-14 px-7 text-lg" disabled={busy} onClick={() => setStartOpen(false)}>Отмена</Button><Button type="button" className="h-14 px-8 text-lg" disabled={busy || !startPatientId} onClick={choosePatient}><UserRound className="size-5" />Выбрать</Button></DialogFooter></DialogContent></Dialog>
    <LiveDataPreviewDialog kind="pressure" open={pressurePreviewOpen} onOpenChange={setPressurePreviewOpen} />
    <LiveDataPreviewDialog kind="emg" open={emgPreviewOpen} onOpenChange={setEmgPreviewOpen} />
    <LiveDataPreviewDialog kind="pgear" open={pgearPreviewOpen} onOpenChange={setPgearPreviewOpen} />
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="max-h-[min(42rem,calc(100vh-2rem))] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Камера и игра</DialogTitle><DialogDescription>Настройки применятся к следующему запуску. Калибровка использует параметры камеры ниже.</DialogDescription></DialogHeader><section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><div><p className="m-0 text-sm font-bold">Калибровка</p><p className="m-0 mt-0.5 text-xs text-slate-500">Настройте камеру и проектор перед игрой.</p></div>{activeJob ? <Button type="button" variant="destructive" disabled={busy} onClick={stopActivity}><CircleStop className="size-4" />Остановить {activeJobLabel}</Button> : <Button type="button" variant="outline" disabled={busy || !activeSession} onClick={() => startActivity('calibration')}><Crosshair className="size-4" />Запустить</Button>}{!activeSession ? <p className="m-0 w-full text-xs text-slate-500">Калибровка будет доступна после начала сеанса.</p> : null}</section><div className="grid gap-4 sm:grid-cols-2"><Field label="Режим игры" value={gameMode} onChange={(value) => setGameMode(value as GameMode)} options={[{ value: 'full', label: t.sessions.modeFull }, { value: 'camera', label: t.sessions.modeCamera }, { value: 'demo', label: t.sessions.modeDemo }]} /><Field label={t.sessions.display} value={game.display} onChange={(value) => setGame((prev) => ({ ...prev, display: value }))} options={displays} /><Field label={t.sessions.rotation} value={String(game.outputRotation)} onChange={(value) => setGame((prev) => ({ ...prev, outputRotation: Number(value) }))} options={rotations} /><Field label={t.sessions.speed} value={String(game.speed)} onChange={(value) => setGame((prev) => ({ ...prev, speed: Number(value) }))} options={['1.5', '2.0', '2.5', '3.0'].map((value) => ({ value, label: value }))} /><Field label={t.sessions.interval} value={String(game.stepTimeS)} onChange={(value) => setGame((prev) => ({ ...prev, stepTimeS: Number(value) }))} options={['0.7', '0.9', '1.2', '1.5'].map((value) => ({ value, label: `${value} с` }))} /><Field label={t.sessions.threshold} value={String(game.insoleThresholdKpa)} onChange={(value) => setGame((prev) => ({ ...prev, insoleThresholdKpa: Number(value) }))} options={['5', '8', '10', '12'].map((value) => ({ value, label: `${value} kPa` }))} /><Field label={t.sessions.camera} value={`${calibration.width}x${calibration.height}`} onChange={(value) => { const [width, height] = value.split('x').map(Number); setCalibration((prev) => ({ ...prev, width, height })) }} options={[['640x480', '640 × 480'], ['848x480', '848 × 480'], ['1280x720', '1280 × 720']].map(([value, label]) => ({ value, label }))} /><Field label={t.sessions.fps} value={String(calibration.fps)} onChange={(value) => setCalibration((prev) => ({ ...prev, fps: Number(value) }))} options={['15', '30', '60'].map((value) => ({ value, label: value }))} /></div><DialogFooter><Button type="button" onClick={() => setSettingsOpen(false)}>Готово</Button></DialogFooter></DialogContent></Dialog>
  </main>
}
