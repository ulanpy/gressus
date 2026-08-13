import { useState } from 'react'
import { CameraIcon } from '../components/runtime/CameraIcon'
import { SliderField } from '../components/runtime/controls/SliderField'
import { Stepper } from '../components/runtime/controls/Stepper'
import { Segmented } from '../components/runtime/controls/Segmented'
import { GAME_DEFAULTS, GAME_PRESETS } from '../constants/runtime'
import { useGameRuntime } from '../hooks/useGameRuntime'
import { useI18n } from '../i18n/context'
import { presetLabel, runtimeErrorText } from '../lib/i18nText'
import { cn } from '../lib/cn'
import { container, panel, workflowBtnPrimary, workflowBtnSecondary } from '../styles/ui'

export function GamePage() {
  const { t } = useI18n()
  const runtime = useGameRuntime()
  const [params, setParams] = useState(GAME_DEFAULTS)
  const [advanced, setAdvanced] = useState(false)
  const running = runtime.snapshot?.state === 'running'
  const gameRunning = runtime.snapshot?.activeJob?.name === 'game'
  const calibrationRunning = runtime.snapshot?.activeJob?.name === 'calibrate_apriltag'
  const canStart = !running && !runtime.pending

  const title = gameRunning
    ? t.control.statusRunningGame
    : calibrationRunning
      ? t.control.statusRunningCalibration
      : t.control.statusReady

  return (
    <div className={cn(container, 'grid gap-5')}>
      <header>
        <h1 className="m-0 text-2xl font-bold text-text-strong">{t.control.tileGame}</h1>
        <p className="mt-2 mb-0 text-sm text-muted">{t.control.lede}</p>
      </header>

      <section className={cn(panel, 'overflow-hidden rounded-3xl bg-white/85')} aria-label={t.control.runtimeAria}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-border px-6 py-4">
          <div className="flex items-center gap-3">
            <span className={cn('h-2.5 w-2.5 rounded-full', running ? 'bg-emerald-500' : 'bg-slate-300')} />
            <div>
              <p className="m-0 font-bold text-text-strong">{title}</p>
              <p className="m-0 text-xs text-muted">
                {runtime.snapshot?.activeJob
                  ? `pid ${runtime.snapshot.activeJob.pid} · ${Math.round(runtime.snapshot.activeJob.uptimeS)}s`
                  : t.control.nothingRunning}
              </p>
            </div>
          </div>
          <button className={workflowBtnSecondary} disabled={!running || runtime.pending} onClick={() => void runtime.stop()}>
            {t.control.stop}
          </button>
        </div>

        <div className="grid gap-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-xs font-bold tracking-[0.15em] text-brand uppercase">{t.control.scenario}</p>
            <div className="flex gap-2" aria-label={t.control.presets}>
              {GAME_PRESETS.map((preset) => (
                <button key={preset.id} className={workflowBtnSecondary} onClick={() => setParams((old) => ({ ...old, ...preset.values }))}>
                  {presetLabel(preset.id, t)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <SliderField label={t.control.speed} hint={t.control.speedHint} value={params.speed} min={0.05} max={1.5} step={0.05} format={(v) => v.toFixed(2)} onChange={(speed) => setParams((old) => ({ ...old, speed }))} />
            <SliderField label={t.control.stepInterval} hint={t.control.stepHint} value={params.stepTimeS} min={0.2} max={2.8} step={0.1} format={(v) => `${v.toFixed(1)} s`} onChange={(stepTimeS) => setParams((old) => ({ ...old, stepTimeS }))} />
            {!params.noInsole && !params.demo && <SliderField label={t.control.pressureThreshold} hint={t.control.thresholdHint} value={params.insoleThresholdKpa} min={0} max={30} step={0.5} format={(v) => `${v.toFixed(1)} ${t.live.kpa}`} onChange={(insoleThresholdKpa) => setParams((old) => ({ ...old, insoleThresholdKpa }))} />}
          </div>

          <div className="flex flex-wrap gap-5">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={params.noInsole || params.demo} disabled={params.demo} onChange={(e) => setParams((old) => ({ ...old, noInsole: e.target.checked }))} />{t.control.noInsole}</label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={params.demo} onChange={(e) => setParams((old) => ({ ...old, demo: e.target.checked }))} />{t.control.demo}</label>
          </div>

          <button className="w-fit border-0 bg-transparent p-0 text-sm font-bold text-brand" onClick={() => setAdvanced((old) => !old)}>{advanced ? t.control.hideScreen : t.control.screenParams}</button>
          {advanced && <div className="flex flex-wrap items-end gap-8"><div><p className="mb-2 text-sm font-semibold">Display</p><Stepper value={params.display ?? 0} min={0} max={4} step={1} onChange={(display) => setParams((old) => ({ ...old, display }))} /></div><div><p className="mb-2 text-sm font-semibold">{t.control.rotation}</p><Segmented options={[0, 90, 180, 270] as const as unknown as (0 | 90 | 180 | 270)[]} value={params.outputRotation} onChange={(outputRotation) => setParams((old) => ({ ...old, outputRotation }))} /></div></div>}

          <div className="flex flex-wrap justify-end gap-3 border-t border-panel-border pt-5">
            <button className={cn(workflowBtnSecondary, 'inline-flex items-center gap-2')} disabled={!canStart} onClick={() => void runtime.startCalibration(params.outputRotation)}><CameraIcon />{t.control.cameraCalibration}</button>
            <button className={workflowBtnPrimary} disabled={!canStart} onClick={() => void runtime.startGame(params)}>{params.demo ? t.control.startGameDemo : params.noInsole ? t.control.startGameNoInsole : t.control.startGame}</button>
          </div>
        </div>
      </section>
      {(runtime.actionError || runtime.error) && <p className="m-0 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{runtimeErrorText(runtime.actionError ?? runtime.error ?? '', t)}</p>}
    </div>
  )
}
