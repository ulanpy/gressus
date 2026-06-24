import { useMemo, useState } from 'react'
import { useExoskeletonTelemetry } from '../hooks/useExoskeletonTelemetry'
import { useI18n } from '../i18n/context'
import {
  postPgearCommand,
  type PgearCommandKey,
  type PgearCommandResponse,
} from '../lib/api/pgear'
import { cn } from '../lib/cn'
import { container, eyebrow, panel } from '../styles/ui'

type CommandTone = 'default' | 'primary' | 'danger' | 'warning'

type CommandConfig = {
  key: PgearCommandKey
  label: string
  description: string
  tone?: CommandTone
}

const commandButtonBase =
  'min-h-[88px] rounded-[8px] border px-4 py-3 text-left transition-[border-color,background,box-shadow,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-55'

const commandButtonTone: Record<CommandTone, string> = {
  default:
    'border-panel-border bg-white text-text-strong hover:border-cyan-400 hover:bg-cyan-50/50',
  primary: 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800',
  danger: 'border-red-600 bg-red-600 text-white hover:bg-red-700',
  warning: 'border-amber-300 bg-amber-50 text-amber-950 hover:border-amber-500',
}

function buildCommandBody(command: PgearCommandKey, profileJson: string, durationS: number) {
  if (command === 'loadProfile') return { profileJson }
  if (command === 'calibrateBaseline') return { durationS }
  return undefined
}

const DEFAULT_PGEAR_PROFILE_JSON = `{
  "mode": "position",
  "cps": 0.36,
  "amp_r": 0.5,
  "amp_l": 0.5,
  "assist": 0.5,
  "aan": false,
  "coeffs": [],
  "rom": {
    "0": [-18, 25],
    "1": [-6, 31],
    "2": [-18, 25],
    "3": [-6, 31]
  },
  "enable": {
    "0": true,
    "1": true,
    "2": true,
    "3": true
  }
}`

export function ExoskeletonControl() {
  const { t } = useI18n()
  const [profileJson, setProfileJson] = useState(DEFAULT_PGEAR_PROFILE_JSON)
  const [durationS, setDurationS] = useState(0)
  const [pendingCommand, setPendingCommand] = useState<PgearCommandKey | null>(null)
  const [lastCommand, setLastCommand] = useState<PgearCommandKey | null>(null)
  const [response, setResponse] = useState<PgearCommandResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { frame: telemetry, status: wsStatus } = useExoskeletonTelemetry(true)

  const commands = useMemo<CommandConfig[]>(
    () => [
      {
        key: 'loadProfile',
        label: t.exoskeleton.loadProfile,
        description: t.exoskeleton.loadProfileHint,
        tone: 'warning',
      },
      {
        key: 'arm',
        label: t.exoskeleton.arm,
        description: t.exoskeleton.armHint,
        tone: 'primary',
      },
      { key: 'disarm', label: t.exoskeleton.disarm, description: t.exoskeleton.disarmHint },
      {
        key: 'run',
        label: t.exoskeleton.run,
        description: t.exoskeleton.runHint,
        tone: 'primary',
      },
      {
        key: 'stopGait',
        label: t.exoskeleton.stopGait,
        description: t.exoskeleton.stopGaitHint,
      },
      {
        key: 'estop',
        label: t.exoskeleton.estop,
        description: t.exoskeleton.estopHint,
        tone: 'danger',
      },
      {
        key: 'estopReset',
        label: t.exoskeleton.estopReset,
        description: t.exoskeleton.estopResetHint,
      },
      {
        key: 'fullCal',
        label: t.exoskeleton.fullCal,
        description: t.exoskeleton.fullCalHint,
        tone: 'warning',
      },
      {
        key: 'calibrateBaseline',
        label: t.exoskeleton.calibrateBaseline,
        description: t.exoskeleton.calibrateBaselineHint,
        tone: 'warning',
      },
    ],
    [t],
  )

  const runCommand = async (command: PgearCommandKey) => {
    setPendingCommand(command)
    setLastCommand(command)
    setResponse(null)
    setError(null)

    try {
      if (command === 'loadProfile') {
        JSON.parse(profileJson)
      }

      const payload = await postPgearCommand(
        command,
        buildCommandBody(command, profileJson, durationS),
      )
      setResponse(payload)
      if (!payload.success) {
        setError(payload.message || t.exoskeleton.commandFailed)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.exoskeleton.commandFailed)
    } finally {
      setPendingCommand(null)
    }
  }

  return (
    <div className={cn(container, 'grid gap-5')}>
      <header>
        <p className={eyebrow}>{t.exoskeleton.eyebrow}</p>
        <h1 className="m-0 text-2xl font-bold tracking-[-0.02em] text-text-strong">
          {t.exoskeleton.title}
        </h1>
      </header>

      <section className={cn(panel, 'grid gap-5 rounded-[24px] p-5')}>
        <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-4 max-[760px]:grid-cols-1">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-text-strong">{t.exoskeleton.profileJson}</span>
            <textarea
              className="ui-input min-h-[132px] resize-y font-mono text-sm leading-6"
              value={profileJson}
              onChange={(event) => setProfileJson(event.target.value)}
              spellCheck={false}
            />
          </label>

          <label className="grid content-start gap-2">
            <span className="text-sm font-bold text-text-strong">
              {t.exoskeleton.baselineDuration}
            </span>
            <input
              className="ui-input"
              type="number"
              min={0}
              max={120}
              step={1}
              value={durationS}
              onChange={(event) => setDurationS(Number(event.target.value))}
            />
            <span className="text-xs text-muted">{t.exoskeleton.baselineDurationHint}</span>
          </label>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3">
          {commands.map((command) => {
            const pending = pendingCommand === command.key
            return (
              <button
                key={command.key}
                type="button"
                className={cn(commandButtonBase, commandButtonTone[command.tone ?? 'default'])}
                onClick={() => void runCommand(command.key)}
                disabled={pendingCommand !== null}
              >
                <span className="block text-base font-bold">
                  {pending ? t.exoskeleton.pending : command.label}
                </span>
                <span
                  className={cn(
                    'mt-1 block text-xs leading-5',
                    command.tone === 'primary' || command.tone === 'danger'
                      ? 'text-white/78'
                      : 'text-muted',
                  )}
                >
                  {command.description}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className={cn(panel, 'grid gap-3 rounded-[18px] p-4 font-mono text-xs')}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <strong>{t.exoskeleton.telemetryTitle}</strong>
          <span className="text-muted">{t.exoskeleton.wsStatus}: {wsStatus}</span>
          <span className={telemetry?.connected ? 'text-emerald-700' : 'text-red-700'}>
            {t.exoskeleton.device}: {telemetry?.connected ? 'OK' : '—'}
          </span>
        </div>

        {telemetry ? (
          <>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
              <div>seq: {telemetry.seq}</div>
              <div>
                gait: {telemetry.gaitPhase} ({telemetry.gaitPhaseName})
              </div>
              <div>step: {telemetry.stepIdx}</div>
              <div>sensor_health: 0x{telemetry.sensorHealthMask.toString(16)}</div>
              <div>flags: 0x{telemetry.flags.toString(16)}</div>
              <div>running: {telemetry.running ? 'yes' : 'no'}</div>
              <div>estop: {telemetry.estop ? 'yes' : 'no'}</div>
              <div>link_age_ms: {telemetry.linkAgeMs}</div>
              <div>amp_r/l: {telemetry.ampR.toFixed(2)} / {telemetry.ampL.toFixed(2)}</div>
              <div>
                assist_r/l: {telemetry.assistR.toFixed(2)} / {telemetry.assistL.toFixed(2)}
              </div>
            </div>
            {telemetry.error ? (
              <div className="text-red-700">error: {telemetry.error}</div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="pr-3">joint</th>
                    <th className="pr-3">ref</th>
                    <th className="pr-3">pos</th>
                    <th className="pr-3">vel</th>
                    <th className="pr-3">torque</th>
                    <th>iq</th>
                  </tr>
                </thead>
                <tbody>
                  {telemetry.joints.map((joint) => (
                    <tr key={joint.name}>
                      <td className="pr-3">{joint.name}</td>
                      <td className="pr-3">{joint.refPos.toFixed(3)}</td>
                      <td className="pr-3">{joint.pos.toFixed(3)}</td>
                      <td className="pr-3">{joint.vel.toFixed(3)}</td>
                      <td className="pr-3">{joint.measTorque.toFixed(3)}</td>
                      <td>{joint.iq.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="text-muted">{t.exoskeleton.telemetryWaiting}</div>
        )}
      </section>

      {(lastCommand || error || response) && (
        <section
          className={cn(
            panel,
            'rounded-[18px] px-4 py-3 text-sm',
            error
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800',
          )}
        >
          <strong>
            {lastCommand
              ? commands.find((command) => command.key === lastCommand)?.label
              : t.exoskeleton.status}
          </strong>
          <span className="ml-2">{error ?? response?.message ?? t.exoskeleton.commandSent}</span>
        </section>
      )}
    </div>
  )
}
