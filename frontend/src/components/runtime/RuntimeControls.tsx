import { useState } from 'react'
import type { GameLaunchParams, RuntimePayload } from '../../types/runtime'
import { useI18n } from '../../i18n/context'
import { GAME_DEFAULTS, GAME_PRESETS } from '../../constants/runtime'
import { presetLabel, runtimeErrorText } from '../../lib/i18nText'
import { cn } from '../../lib/cn'
import { CameraIcon } from './CameraIcon'
import { Field } from './controls/Field'
import { SliderField } from './controls/SliderField'
import { Stepper } from './controls/Stepper'
import { Segmented } from './controls/Segmented'

const panel = 'border border-panel-border bg-panel shadow-panel backdrop-blur-[18px]'

const primaryButton =
  'rounded-full border-0 px-[22px] py-3 text-sm font-bold text-white bg-slate-900 shadow-[0_10px_26px_rgb(15_23_42/0.22)] transition-[transform,box-shadow,opacity,background] duration-100 hover:enabled:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none'

const secondaryButton =
  'rounded-full border border-panel-border bg-white px-[22px] py-3 text-sm font-bold text-text-strong transition-[transform,box-shadow,opacity,background,border-color,color] duration-100 hover:enabled:-translate-y-px hover:enabled:border-cyan-400 hover:enabled:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none'

const switchBase =
  'runtime-switch inline-flex cursor-pointer select-none items-center gap-2.5 rounded-full border border-panel-border bg-slate-50 py-1.5 pl-1.5 pr-3 text-[13px] font-semibold text-text-strong transition-[background,border-color] duration-150 hover:border-cyan-400'

export function RuntimeControls({
  actionError,
  pending,
  runtime,
  disabled = false,
  startCalibration,
  startGame,
  stopRuntime,
}: {
  actionError: string | null
  pending: boolean
  runtime: RuntimePayload
  disabled?: boolean
  startCalibration: (params: Pick<GameLaunchParams, 'outputRotation'>) => Promise<void>
  startGame: (params: GameLaunchParams) => Promise<void>
  stopRuntime: () => Promise<void>
}) {
  const { t } = useI18n()
  const [gameParams, setGameParams] = useState<GameLaunchParams>(GAME_DEFAULTS)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const canStart = runtime.state === 'idle' && !pending && !disabled
  const canStop = runtime.state === 'running' && !pending && !disabled
  const isGameRunning = runtime.activeJob?.name === 'game'
  const isCalibRunning = runtime.activeJob?.name === 'calibrate_apriltag'

  const statusTitle =
    isGameRunning
      ? t.control.statusRunningGame
      : isCalibRunning
      ? t.control.statusRunningCalibration
      : t.control.statusReady
  const statusMeta = runtime.activeJob
    ? `pid ${runtime.activeJob.pid} · ${t.control.uptime} ${Math.round(runtime.activeJob.uptimeS)}с`
    : runtime.lastExit
    ? `${t.control.last}: ${runtime.lastExit.name ?? '-'} · code ${runtime.lastExit.code ?? '-'}`
    : t.control.nothingRunning

  return (
    <section
      className={cn('relative z-0 grid w-full gap-4', disabled && 'opacity-[0.72]')}
      aria-label={t.control.runtimeAria}
    >
      <header
        className={cn(
          panel,
          'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[18px] rounded-[22px] px-[18px] py-[14px] max-[980px]:grid-cols-1',
        )}
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            className={cn(
              'h-3 w-3 shrink-0 rounded-full bg-slate-400 shadow-[0_0_0_4px_rgb(148_163_184/0.15)]',
              runtime.state === 'running' &&
                'animate-runtime-pulse bg-emerald-500 shadow-[0_0_0_4px_rgb(16_185_129/0.18)]',
            )}
            aria-hidden
          />
          <div className="grid min-w-0 gap-0.5">
            <p className="m-0 text-[17px] font-bold leading-tight text-text-strong">{statusTitle}</p>
            <span className="text-[13px] tracking-[0.02em] text-muted">{statusMeta}</span>
          </div>
        </div>
        <button
          type="button"
          className="rounded-full border-0 bg-[rgb(225_45_30)] px-[22px] py-[11px] font-bold text-white shadow-[0_12px_28px_rgb(225_45_30/0.28)] transition-[transform,box-shadow,opacity] duration-100 hover:enabled:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none max-[980px]:justify-self-start"
          onClick={() => void stopRuntime()}
          disabled={!canStop}
        >
          {t.control.stop}
        </button>
      </header>

      <article className={cn(panel, 'grid min-w-0 gap-5 rounded-3xl p-6')}>
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3.5 max-[980px]:grid-cols-1 max-[980px]:gap-3">
          <div>
            <p className="m-0 mb-1 text-[11px] font-bold tracking-[0.2em] text-brand uppercase">{t.control.scenario}</p>
            <h2 className="m-0 text-[22px] tracking-[-0.02em] text-text-strong">{t.control.tileGame}</h2>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.control.presets}>
            {GAME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="rounded-full border border-panel-border bg-white px-3 py-[7px] text-xs font-semibold tracking-[0.02em] text-text-strong hover:enabled:border-cyan-400 hover:enabled:text-cyan-700"
                onClick={() => setGameParams((prev) => ({ ...prev, ...preset.values }))}
              >
                {presetLabel(preset.id, t)}
              </button>
            ))}
          </div>
        </header>

        <div className="grid gap-[18px]">
          <SliderField
            label={t.control.speed}
            hint={t.control.speedHint}
            value={gameParams.speed}
            onChange={(value) => setGameParams((prev) => ({ ...prev, speed: value }))}
            min={0.05}
            max={1.5}
            step={0.05}
            format={(value) => value.toFixed(2)}
          />
          <SliderField
            label={t.control.stepInterval}
            hint={t.control.stepHint}
            value={gameParams.stepTimeS}
            onChange={(value) => setGameParams((prev) => ({ ...prev, stepTimeS: value }))}
            min={0.2}
            max={2.8}
            step={0.1}
            format={(value) => `${value.toFixed(2)} s`}
          />
          {!gameParams.noInsole && (
            <SliderField
              label={t.control.pressureThreshold}
              hint={t.control.thresholdHint}
              value={gameParams.insoleThresholdKpa}
              onChange={(value) => setGameParams((prev) => ({ ...prev, insoleThresholdKpa: value }))}
              min={0}
              max={30}
              step={0.5}
              format={(value) => `${value.toFixed(1)} ${t.live.kpa}`}
            />
          )}
        </div>

        <button
          type="button"
          className="cursor-pointer justify-self-start border-0 bg-transparent px-0 py-1 text-[13px] font-bold tracking-[0.02em] text-brand hover:text-cyan-700"
          onClick={() => setShowAdvanced((value) => !value)}
        >
          {showAdvanced ? t.control.hideScreen : t.control.screenParams}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-4 rounded-2xl bg-slate-100/50 p-4 max-[980px]:grid-cols-1">
            <Field label="Display" hint={t.control.displayHint}>
              <Stepper
                value={gameParams.display ?? 0}
                onChange={(value) => setGameParams((prev) => ({ ...prev, display: value }))}
                min={0}
                max={4}
                step={1}
              />
            </Field>
            <Field label={t.control.rotation} hint="output-rotation">
              <Segmented
                options={[0, 90, 180, 270]}
                value={gameParams.outputRotation}
                onChange={(value) =>
                  setGameParams((prev) => ({
                    ...prev,
                    outputRotation: value as 0 | 90 | 180 | 270,
                  }))
                }
              />
            </Field>
          </div>
        )}

        <footer className="flex flex-wrap items-center gap-2.5 pt-1.5 max-[980px]:flex-col-reverse max-[980px]:items-stretch [&_button]:max-[980px]:w-full [&>:first-child]:mr-auto">
          <button
            type="button"
            className={cn(secondaryButton, 'inline-flex items-center gap-2')}
            onClick={() => void startCalibration({ outputRotation: gameParams.outputRotation })}
            disabled={!canStart}
          >
            <CameraIcon />
            {t.control.cameraCalibration}
          </button>
          <label
            className={cn(
              switchBase,
              (gameParams.noInsole || gameParams.demo) &&
                'runtime-switch--on border-amber-400 bg-amber-50 text-amber-900',
            )}
            title={t.control.noInsoleHint}
          >
            <input
              type="checkbox"
              checked={gameParams.noInsole || gameParams.demo}
              disabled={gameParams.demo}
              onChange={(event) => {
                const checked = event.target.checked
                setGameParams((prev) => ({ ...prev, noInsole: checked }))
              }}
            />
            <span className="runtime-switch-track" aria-hidden />
            <span className="whitespace-nowrap">{t.control.noInsole}</span>
          </label>
          <label
            className={cn(
              switchBase,
              'runtime-switch--demo',
              gameParams.demo && 'runtime-switch--on',
            )}
            title={t.control.demoHint}
          >
            <input
              type="checkbox"
              checked={gameParams.demo}
              onChange={(event) => {
                const checked = event.target.checked
                setGameParams((prev) => ({ ...prev, demo: checked }))
              }}
            />
            <span className="runtime-switch-track" aria-hidden />
            <span className="whitespace-nowrap">{t.control.demo}</span>
          </label>
          <button
            type="button"
            className={primaryButton}
            onClick={() => void startGame(gameParams)}
            disabled={!canStart}
          >
            {gameParams.demo
              ? t.control.startGameDemo
              : gameParams.noInsole
              ? t.control.startGameNoInsole
              : t.control.startGame}
          </button>
        </footer>
      </article>

      {actionError && (
        <p className="m-0 mx-auto w-full max-w-[1280px] rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {runtimeErrorText(actionError, t)}
        </p>
      )}
    </section>
  )
}
