import { useState } from 'react'
import type { GameLaunchParams, RuntimePayload } from '../../types/runtime'
import { useI18n } from '../../i18n/context'
import { GAME_DEFAULTS, GAME_PRESETS } from '../../constants/runtime'
import { presetLabel, runtimeErrorText } from '../../lib/i18nText'
import { CameraIcon } from './CameraIcon'
import { Field } from './controls/Field'
import { SliderField } from './controls/SliderField'
import { Stepper } from './controls/Stepper'
import { Segmented } from './controls/Segmented'


export function RuntimeControls({
  actionError,
  actionLogTail,
  pending,
  runtime,
  startCalibration,
  startGame,
  stopRuntime,
}: {
  actionError: string | null
  actionLogTail: string | null
  pending: boolean
  runtime: RuntimePayload
  startCalibration: () => Promise<void>
  startGame: (params: GameLaunchParams) => Promise<void>
  stopRuntime: () => Promise<void>
}) {
  const { t } = useI18n()
  const [gameParams, setGameParams] = useState<GameLaunchParams>(GAME_DEFAULTS)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const canStart = runtime.state === 'idle' && !pending
  const canStop = runtime.state === 'running' && !pending
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
    <section className="runtime" aria-label={t.control.runtimeAria}>
      <header className="runtime__statusbar">
        <div className="runtime__status">
          <span
            className={`runtime__indicator ${runtime.state === 'running' ? 'runtime__indicator--running' : ''}`}
            aria-hidden
          />
          <div className="runtime__status-text">
            <p className="runtime__status-title">{statusTitle}</p>
            <span className="runtime__status-meta">{statusMeta}</span>
          </div>
        </div>
        <button
          type="button"
          className="runtime__stop"
          onClick={() => void stopRuntime()}
          disabled={!canStop}
        >
          {t.control.stop}
        </button>
      </header>

      <article className="runtime__card">
        <header className="runtime__card-head">
          <div>
            <p className="runtime__card-eyebrow">{t.control.scenario}</p>
            <h2 className="runtime__card-title">{t.control.tileGame}</h2>
          </div>
          <div className="runtime__preset-row" role="group" aria-label={t.control.presets}>
            {GAME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="runtime__preset"
                onClick={() => setGameParams((prev) => ({ ...prev, ...preset.values }))}
              >
                {presetLabel(preset.id, t)}
              </button>
            ))}
          </div>
        </header>

        <div className="runtime__sliders">
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
          className="runtime__advanced-toggle"
          onClick={() => setShowAdvanced((value) => !value)}
        >
          {showAdvanced ? t.control.hideScreen : t.control.screenParams}
        </button>

        {showAdvanced && (
          <div className="runtime__advanced">
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

        <footer className="runtime__card-actions">
          <button
            type="button"
            className="runtime__secondary runtime__secondary--icon"
            onClick={() => void startCalibration()}
            disabled={!canStart}
          >
            <CameraIcon />
            {t.control.cameraCalibration}
          </button>
          <label
            className={`runtime__switch${gameParams.noInsole || gameParams.demo ? ' runtime__switch--on' : ''}`}
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
            <span className="runtime__switch-track" aria-hidden />
            <span className="runtime__switch-label">{t.control.noInsole}</span>
          </label>
          <label
            className={`runtime__switch runtime__switch--demo${gameParams.demo ? ' runtime__switch--on' : ''}`}
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
            <span className="runtime__switch-track" aria-hidden />
            <span className="runtime__switch-label">{t.control.demo}</span>
          </label>
          <button
            type="button"
            className="runtime__primary"
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

      {actionError && <p className="error runtime__error">{runtimeErrorText(actionError, t)}</p>}
      {actionLogTail && (
        <details className="runtime__log" open>
          <summary>{t.control.logTail}</summary>
          <pre>{actionLogTail}</pre>
        </details>
      )}
    </section>
  )
}
