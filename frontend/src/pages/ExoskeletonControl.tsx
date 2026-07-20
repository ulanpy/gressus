import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n/context'
import {
  useExoskeletonTelemetry,
  type ExoskeletonControlFlags,
} from '../hooks/useExoskeletonTelemetry'
import { useRuntimeStatus } from '../hooks/useRuntimeStatus'
import { listPatients } from '../lib/api/patients'
import { getLatestAnthropometrics, getLatestExoProfile, type LatestExoProfile } from '../lib/api/sessions'
import type { SessionAnthropometrics } from '../types/sessions'
import {
  buildAnthropometricsPayload,
  DEFAULT_ANTHROPOMETRICS,
} from '../components/sessions/SessionAnthropometricsLine'
import { LiveJointTelemetryChart } from '../components/exoskeleton/LiveJointTelemetryChart'
import {
  startRecordingSession,
  stopRecordingSession,
  type SessionActionResponse,
} from '../lib/api/runtime'
import { mapExoErrorDetail, resolveExoLinkStatus } from '../lib/exoskeleton/statusText'
import { cn } from '../lib/cn'
import type { Patient } from '../types/patients'

type SessionState =
  | 'Idle'
  | 'Selecting Patient'
  | 'Arming'
  | 'Loading Profile'
  | 'Ready'
  | 'Running'
  | 'Stopping'
  | 'Calibrating'
  | 'Error'
  | 'E-STOP Active'
type WorkflowState = 'initial' | 'ready' | 'running' | 'error' | 'estop'
type StepStatus = 'idle' | 'running' | 'success' | 'error'
type ProgressStepId =
  | 'arm'
  | 'profile'
  | 'configuration'
  | 'baseline'
  | 'gait'
  | 'running'
  | 'stopped'

type ProgressStep = {
  id: ProgressStepId
  label: string
  status: StepStatus
  detail?: string
}

type GaitProfile = {
  id: string
  name: string
  description: string
  profileJson: string
  baselineRequired: boolean
}

/** Editable exo-profile parameters shown before starting a session. */
type ExoParams = {
  cps: number
  amp_r: number
  amp_l: number
  assist: number
}

const DEFAULT_EXO_PARAMS: ExoParams = { cps: 0.36, amp_r: 0.5, amp_l: 0.5, assist: 0.5 }

type RomMap = Record<string, [number, number]>
type EnableMap = Record<string, boolean>
type ExoMode = 'position' | 'torque'

// Structural fields the P.GEAR device expects in load_profile (API.md §7 /
// profile_loader.apply_profile). Joints: 0=R-hip, 1=R-knee, 2=L-hip, 3=L-knee.
// Anything absent here is simply never sent to the ESP, so the device keeps its
// firmware defaults — that is why earlier profiles only carried cps/amp/assist.
const DEFAULT_EXO_MODE: ExoMode = 'position'
const DEFAULT_EXO_AAN = false
const DEFAULT_EXO_ROM: RomMap = {
  '0': [-18, 25],
  '1': [-6, 31],
  '2': [-18, 25],
  '3': [-6, 31],
}
const DEFAULT_EXO_ENABLE: EnableMap = { '0': true, '1': true, '2': true, '3': true }

const EXO_JOINTS: { idx: string; label: string }[] = [
  { idx: '0', label: 'R-Hip' },
  { idx: '1', label: 'R-Knee' },
  { idx: '2', label: 'L-Hip' },
  { idx: '3', label: 'L-Knee' },
]

/** Structural profile fields (mode/aan/rom/enable) parsed from a stored profile. */
type ExoStructural = {
  mode: ExoMode
  aan: boolean
  rom: RomMap
  enable: EnableMap
}

const DEFAULT_EXO_STRUCTURAL: ExoStructural = {
  mode: DEFAULT_EXO_MODE,
  aan: DEFAULT_EXO_AAN,
  rom: DEFAULT_EXO_ROM,
  enable: DEFAULT_EXO_ENABLE,
}

function parseStructural(src: Record<string, unknown>): ExoStructural {
  const srcRom = (src.rom ?? {}) as Record<string, unknown>
  const srcEnable = (src.enable ?? {}) as Record<string, unknown>
  const rom: RomMap = {}
  const enable: EnableMap = {}
  for (const { idx } of EXO_JOINTS) {
    const r = srcRom[idx]
    const dflt = DEFAULT_EXO_ROM[idx]
    rom[idx] = Array.isArray(r) ? [toNumber(r[0], dflt[0]), toNumber(r[1], dflt[1])] : dflt
    const e = srcEnable[idx]
    enable[idx] = typeof e === 'boolean' ? e : DEFAULT_EXO_ENABLE[idx]
  }
  return {
    mode: src.mode === 'torque' ? 'torque' : DEFAULT_EXO_MODE,
    aan: typeof src.aan === 'boolean' ? src.aan : DEFAULT_EXO_AAN,
    rom,
    enable,
  }
}

const EXO_PARAM_FIELDS: { key: keyof ExoParams; label: string; step: number }[] = [
  { key: 'cps', label: 'CPS (скорость)', step: 0.01 },
  { key: 'assist', label: 'Assist', step: 0.05 },
  { key: 'amp_r', label: 'Amplitude R', step: 0.05 },
  { key: 'amp_l', label: 'Amplitude L', step: 0.05 },
]

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** Parse a stored exo_profile JSON into editable params + carried-over extras. */
function parseStoredProfile(profileJson: string): {
  params: ExoParams
  extras: Record<string, unknown>
  hasCoeffs: boolean
} | null {
  try {
    const parsed = JSON.parse(profileJson) as Record<string, unknown>
    const inner =
      parsed.profile && typeof parsed.profile === 'object'
        ? (parsed.profile as Record<string, unknown>)
        : parsed
    return {
      params: {
        cps: toNumber(inner.cps, DEFAULT_EXO_PARAMS.cps),
        amp_r: toNumber(inner.amp_r, DEFAULT_EXO_PARAMS.amp_r),
        amp_l: toNumber(inner.amp_l, DEFAULT_EXO_PARAMS.amp_l),
        assist: toNumber(inner.assist, DEFAULT_EXO_PARAMS.assist),
      },
      extras: inner,
      hasCoeffs: Array.isArray(inner.coeffs) && inner.coeffs.length > 0,
    }
  } catch {
    return null
  }
}

type IconName =
  | 'alert'
  | 'check'
  | 'clock'
  | 'gear'
  | 'lock'
  | 'play'
  | 'refresh'
  | 'stop'
  | 'unlock'
  | 'upload'
  | 'wifi'

const fallbackPatients: Patient[] = [
  {
    id: 'demo-patient',
    display_name: 'Demo Patient',
    date_of_birth: null,
    sex: 'unknown',
    cp_type: 'Standard gait training',
    affected_side: null,
    gmfcs_current: null,
    dominant_side: null,
    comorbidities: null,
    contraindications: null,
    consent_on_file: true,
    consent_date: null,
    guardian_contact: null,
    enrollment_date: null,
    created_at: '',
    updated_at: '',
    archived_at: null,
  },
]

const initialProgress: ProgressStep[] = [
  { id: 'arm', label: 'Arm complete', status: 'idle' },
  { id: 'profile', label: 'Profile loaded', status: 'idle' },
  { id: 'configuration', label: 'Configuration checked', status: 'idle' },
  { id: 'baseline', label: 'Baseline calibrated', status: 'idle' },
  { id: 'gait', label: 'Recording started', status: 'idle' },
  { id: 'running', label: 'Session running', status: 'idle' },
  { id: 'stopped', label: 'Session stopped', status: 'idle' },
]

function Icon({ name, className }: { name: IconName; className?: string }) {
  const common = {
    className: cn('h-6 w-6', className),
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2,
    viewBox: '0 0 24 24',
  }

  if (name === 'alert') {
    return (
      <svg {...common}>
        <path d="M12 4 21 20H3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    )
  }
  if (name === 'check') {
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    )
  }
  if (name === 'clock') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  }
  if (name === 'gear') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.4 3a8 8 0 0 0-1.7 1L5 6 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5 18l2.4-1a8 8 0 0 0 1.7 1l.4 3h5l.4-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2.1-1.5a7 7 0 0 0 .1-1Z" />
      </svg>
    )
  }
  if (name === 'lock') {
    return (
      <svg {...common}>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    )
  }
  if (name === 'play') {
    return (
      <svg {...common}>
        <path d="M8 5v14l11-7Z" />
      </svg>
    )
  }
  if (name === 'refresh') {
    return (
      <svg {...common}>
        <path d="M20 12a8 8 0 1 1-2.3-5.6" />
        <path d="M20 4v6h-6" />
      </svg>
    )
  }
  if (name === 'stop') {
    return (
      <svg {...common}>
        <rect x="7" y="7" width="10" height="10" rx="2" />
      </svg>
    )
  }
  if (name === 'unlock') {
    return (
      <svg {...common}>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 7-2.7" />
      </svg>
    )
  }
  if (name === 'upload') {
    return (
      <svg {...common}>
        <path d="M12 4v12" />
        <path d="m7 9 5-5 5 5" />
        <path d="M5 20h14" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M5 14a10 10 0 0 1 14 0" />
      <path d="M8.5 17.5a5 5 0 0 1 7 0" />
      <path d="M12 21h.01" />
    </svg>
  )
}

function setStep(
  steps: ProgressStep[],
  id: ProgressStepId,
  status: StepStatus,
  detail?: string,
) {
  return steps.map((step) => (step.id === id ? { ...step, status, detail } : step))
}

function stepIcon(status: StepStatus) {
  if (status === 'success') return '✓'
  if (status === 'running') return '⟳'
  if (status === 'error') return '!'
  return '○'
}

function formatMs(value = 0) {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

function clampRatio(value: number) {
  return Math.max(0, Math.min(1, value))
}

function formatPct01(value: number): string {
  return `${Math.round(clampRatio(value) * 100)}%`
}

/** Side-by-side L/R level bars — easier to read than four identical dials. */
function LevelPairCard({
  title,
  hint,
  left,
  right,
  leftColor,
  rightColor,
  leftLabel,
  rightLabel,
}: {
  title: string
  hint: string
  left: number
  right: number
  leftColor: string
  rightColor: string
  leftLabel: string
  rightLabel: string
}) {
  const rows = [
    { label: leftLabel, value: left, color: leftColor },
    { label: rightLabel, value: right, color: rightColor },
  ] as const

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgb(15_23_42/0.04)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[15px] font-extrabold text-slate-950">{title}</div>
        <div className="text-[12px] font-semibold text-slate-500">{hint}</div>
      </div>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => {
          const pct = Math.round(clampRatio(row.value) * 100)
          return (
            <div key={row.label} className="grid grid-cols-[52px_minmax(0,1fr)_48px] items-center gap-3">
              <span className="text-xs font-extrabold text-slate-600">{row.label}</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-[width] duration-300 ease-out"
                  style={{ width: `${pct}%`, background: row.color }}
                />
              </div>
              <span
                className="text-right text-sm font-extrabold tabular-nums"
                style={{ color: row.color }}
              >
                {formatPct01(row.value)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ConnectingTelemetry({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgb(15_23_42/0.05)]">
      <div className="grid min-h-[420px] place-items-center text-center">
        <div className="grid justify-items-center gap-5">
          <div className="relative h-24 w-24">
            <div className="absolute inset-0 rounded-full border-8 border-slate-200" />
            <div className="absolute inset-0 animate-spin rounded-full border-8 border-transparent border-t-blue-500" />
          </div>
          <div>
            <h1 className="m-0 text-[24px] font-extrabold text-slate-950">{title}</h1>
            <p className="mt-2 mb-0 max-w-[360px] text-sm font-semibold leading-6 text-slate-500">
              {detail}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function InfoCard({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgb(15_23_42/0.04)]">
      <div className="text-[13px] font-extrabold text-slate-500">{label}</div>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function PrimaryAction({
  disabled,
  icon,
  onClick,
  subtitle,
  title,
  variant = 'primary',
}: {
  disabled?: boolean
  icon: IconName
  onClick: () => void
  subtitle: string
  title: string
  variant?: 'danger' | 'primary'
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-grid shrink-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-2xl border px-4 py-3 text-left text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45',
        variant === 'danger'
          ? 'border-red-600 bg-red-600 shadow-[0_14px_28px_rgb(220_38_38/0.22)]'
          : 'border-slate-950 bg-slate-950 shadow-[0_14px_28px_rgb(15_23_42/0.16)]',
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-white/12">
        <Icon name={icon} className="h-5 w-5 text-white" />
      </span>
      <span className="min-w-0 pr-1">
        <span className="block text-[16px] font-extrabold leading-tight">{title}</span>
        <span className="mt-0.5 block text-[12px] font-semibold leading-4 text-white/70">
          {subtitle}
        </span>
      </span>
    </button>
  )
}

function ProfileDialog({
  confirmLabel = 'Подтвердить и загрузить',
  includeAnthropometrics = false,
  initialPatientId,
  initialProfile,
  loading,
  onClose,
  onConfirm,
  patients,
  title = 'Начать сессию',
}: {
  confirmLabel?: string
  includeAnthropometrics?: boolean
  initialPatientId?: string | null
  initialProfile?: GaitProfile | null
  loading: boolean
  onClose: () => void
  onConfirm: (patient: Patient, profile: GaitProfile, anthropometrics?: SessionAnthropometrics) => void
  patients: Patient[]
  title?: string
}) {
  const { t } = useI18n()
  const availablePatients = patients.length ? patients : fallbackPatients
  const [patientId, setPatientId] = useState(initialPatientId ?? availablePatients[0]?.id ?? '')
  const patient = availablePatients.find((item) => item.id === patientId) ?? availablePatients[0]
  const [lastProfile, setLastProfile] = useState<LatestExoProfile | null>(null)
  const [lastProfileLoading, setLastProfileLoading] = useState(false)
  const [params, setParams] = useState<ExoParams>(DEFAULT_EXO_PARAMS)
  const [extras, setExtras] = useState<Record<string, unknown>>({})
  const [structural, setStructural] = useState<ExoStructural>(DEFAULT_EXO_STRUCTURAL)
  const [anthropometrics, setAnthropometrics] = useState<SessionAnthropometrics>(
    DEFAULT_ANTHROPOMETRICS,
  )

  useEffect(() => {
    if (!patient) {
      setLastProfile(null)
      return
    }
    let cancelled = false
    setLastProfileLoading(true)
    getLatestExoProfile(patient.id)
      .then((found) => {
        if (!cancelled) setLastProfile(found)
      })
      .catch(() => {
        if (!cancelled) setLastProfile(null)
      })
      .finally(() => {
        if (!cancelled) setLastProfileLoading(false)
      })
    getLatestAnthropometrics(patient.id)
      .then((found) => {
        if (!cancelled && found) {
          setAnthropometrics({
            leg_length_left: found.leg_length_left ?? DEFAULT_ANTHROPOMETRICS.leg_length_left,
            leg_length_right: found.leg_length_right ?? DEFAULT_ANTHROPOMETRICS.leg_length_right,
            bodyweight: found.bodyweight ?? null,
          })
        }
      })
      .catch(() => {
        if (!cancelled) setAnthropometrics(DEFAULT_ANTHROPOMETRICS)
      })
    return () => {
      cancelled = true
    }
  }, [patient?.id])

  // Prefill the editable params from the patient's last session (or defaults).
  useEffect(() => {
    const parsedInitial =
      initialProfile && patient?.id === initialPatientId
        ? parseStoredProfile(initialProfile.profileJson)
        : null
    const parsed = parsedInitial ?? (lastProfile ? parseStoredProfile(lastProfile.profileJson) : null)
    if (parsed) {
      setParams(parsed.params)
      setExtras(parsed.extras)
      setStructural(parseStructural(parsed.extras))
    } else {
      setParams(DEFAULT_EXO_PARAMS)
      setExtras({})
      setStructural(DEFAULT_EXO_STRUCTURAL)
    }
  }, [initialPatientId, initialProfile, lastProfile, patient?.id])

  const hasStoredCoeffs = Array.isArray(extras.coeffs) && extras.coeffs.length > 0

  const buildProfileJson = (): string => {
    const { coeffs: _coeffs, meta: _meta, rom: _rom, enable: _enable, mode: _mode, aan: _aan, ...carry } =
      extras
    // Carry over any unknown fields, then write the edited structural + scalar
    // params so the device always gets mode/rom/enable/aan.
    const profile: Record<string, unknown> = {
      ...carry,
      mode: structural.mode,
      aan: structural.aan,
      rom: structural.rom,
      enable: structural.enable,
      patient_id: patient?.id,
      patient_name: patient?.display_name,
      cps: params.cps,
      amp_r: params.amp_r,
      amp_l: params.amp_l,
      assist: params.assist,
    }
    profile.coeffs = hasStoredCoeffs ? extras.coeffs : []
    return JSON.stringify(profile, null, 2)
  }

  const setParam = (key: keyof ExoParams) => (event: { target: { value: string } }) =>
    setParams((prev) => ({ ...prev, [key]: toNumber(event.target.value, prev[key]) }))

  const setRomBound =
    (idx: string, which: 0 | 1) => (event: { target: { value: string } }) =>
      setStructural((prev) => {
        const cur = prev.rom[idx] ?? DEFAULT_EXO_ROM[idx]
        const value = toNumber(event.target.value, cur[which])
        const next: [number, number] = which === 0 ? [value, cur[1]] : [cur[0], value]
        return { ...prev, rom: { ...prev.rom, [idx]: next } }
      })

  const toggleEnable = (idx: string) => (event: { target: { checked: boolean } }) =>
    setStructural((prev) => ({
      ...prev,
      enable: { ...prev.enable, [idx]: event.target.checked },
    }))

  const setAnthro =
    (key: keyof SessionAnthropometrics) => (event: { target: { value: string } }) => {
      const raw = event.target.value
      const parsed = raw === '' ? null : Number(raw)
      setAnthropometrics((prev) => ({
        ...prev,
        [key]: parsed != null && Number.isFinite(parsed) ? parsed : null,
      }))
    }

  const handleConfirm = () => {
    if (!patient) return
    onConfirm(
      patient,
      {
        id: 'exo-profile',
        name: initialProfile
          ? 'Обновлённый профиль'
          : lastProfile
          ? `Профиль (из сессии #${lastProfile.sessionNumber ?? '—'})`
          : 'Новый профиль',
        description: '',
        baselineRequired: false,
        profileJson: buildProfileJson(),
      },
      buildAnthropometricsPayload(anthropometrics),
    )
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-5 backdrop-blur-[2px]">
      <section className="max-h-[88vh] w-full max-w-[620px] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_28px_90px_rgb(15_23_42/0.22)]">
        <h2 className="m-0 text-[22px] font-extrabold text-slate-950">{title}</h2>
        <p className="mt-2 mb-5 text-sm font-semibold text-slate-500">
          Выберите пациента и параметры экзо-профиля. Профиль будет загружен на контроллер
          при старте.
        </p>

        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-extrabold text-slate-700">Пациент</span>
            <select
              className="ui-select"
              value={patientId}
              onChange={(event) => setPatientId(event.target.value)}
            >
              {availablePatients.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.display_name}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600">
            {lastProfileLoading
              ? 'Загрузка профиля прошлой сессии…'
              : lastProfile
                ? `Параметры предзаполнены из сессии #${lastProfile.sessionNumber ?? '—'}${
                    lastProfile.sessionDate ? ` (${lastProfile.sessionDate})` : ''
                  }.${hasStoredCoeffs ? ' Baseline-коэффициенты сохранены.' : ''}`
                : 'Прошлых профилей нет — значения по умолчанию.'}
          </div>

          {includeAnthropometrics ? (
            <div className="grid gap-2">
              <span className="text-sm font-extrabold text-slate-700">{t.workflow.sessionAnthropometrics}</span>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-extrabold text-slate-600">{t.workflow.legLengthLeft}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900"
                    value={anthropometrics.leg_length_left ?? ''}
                    onChange={setAnthro('leg_length_left')}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-extrabold text-slate-600">{t.workflow.legLengthRight}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900"
                    value={anthropometrics.leg_length_right ?? ''}
                    onChange={setAnthro('leg_length_right')}
                  />
                </label>
                <label className="col-span-2 grid gap-1">
                  <span className="text-xs font-extrabold text-slate-600">{t.workflow.bodyweight}</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900"
                    value={anthropometrics.bodyweight ?? ''}
                    onChange={setAnthro('bodyweight')}
                  />
                </label>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            {EXO_PARAM_FIELDS.map((field) => (
              <label key={field.key} className="grid gap-1">
                <span className="text-xs font-extrabold text-slate-600">{field.label}</span>
                <input
                  type="number"
                  step={field.step}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900"
                  value={params[field.key]}
                  onChange={setParam(field.key)}
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-extrabold text-slate-600">Режим (mode)</span>
              <select
                className="ui-select"
                value={structural.mode}
                onChange={(event) =>
                  setStructural((prev) => ({ ...prev, mode: event.target.value as ExoMode }))
                }
              >
                <option value="position">position</option>
                <option value="torque">torque</option>
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={structural.aan}
                onChange={(event) =>
                  setStructural((prev) => ({ ...prev, aan: event.target.checked }))
                }
              />
              <span>AAN (assist-as-needed)</span>
            </label>
          </div>

          <div className="grid gap-2 rounded-2xl bg-slate-50 p-3">
            <span className="text-xs font-extrabold text-slate-600">
              Суставы: ROM (°) и enable
            </span>
            <div className="grid gap-2">
              {EXO_JOINTS.map(({ idx, label }) => (
                <div key={idx} className="grid grid-cols-[88px_1fr_1fr_auto] items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-700">{label}</span>
                  <input
                    type="number"
                    step={1}
                    aria-label={`${label} ROM min`}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900"
                    value={structural.rom[idx]?.[0] ?? DEFAULT_EXO_ROM[idx][0]}
                    onChange={setRomBound(idx, 0)}
                  />
                  <input
                    type="number"
                    step={1}
                    aria-label={`${label} ROM max`}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900"
                    value={structural.rom[idx]?.[1] ?? DEFAULT_EXO_ROM[idx][1]}
                    onChange={setRomBound(idx, 1)}
                  />
                  <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={structural.enable[idx] ?? true}
                      onChange={toggleEnable(idx)}
                    />
                    on
                  </label>
                </div>
              ))}
            </div>
          </div>

          <details className="rounded-2xl bg-slate-50 p-3">
            <summary className="cursor-pointer text-xs font-extrabold text-slate-600">
              Exo profile JSON
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto text-xs leading-5 text-slate-700">
              {buildProfileJson()}
            </pre>
          </details>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-700"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-950 bg-slate-950 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-45"
            disabled={loading || lastProfileLoading}
            onClick={handleConfirm}
          >
            {loading ? 'Загрузка…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

function SimplifiedTelemetry({
  onFlagsChange,
  progress,
  sessionState,
}: {
  onFlagsChange: (flags: ExoskeletonControlFlags) => void
  progress: ProgressStep[]
  sessionState: SessionState
}) {
  const { t } = useI18n()
  const exo = t.exoskeleton
  const {
    snapshot: runtime,
    loading: statusLoading,
    error: statusError,
  } = useRuntimeStatus(true)
  const { frame: telemetry, history, flags, windowSeconds } = useExoskeletonTelemetry(true)
  const pgear = runtime?.pgear ?? null

  useEffect(() => {
    onFlagsChange(flags)
  }, [flags, onFlagsChange])

  if (statusLoading && !pgear) {
    return <ConnectingTelemetry title={exo.connectingTitle} detail={exo.connectingDetail} />
  }

  const link = resolveExoLinkStatus(pgear, statusError, t)
  const errorDetail =
    link.tone === 'waiting'
      ? mapExoErrorDetail(telemetry?.error, t)
      : mapExoErrorDetail(pgear?.error, t) ??
        mapExoErrorDetail(statusError, t) ??
        mapExoErrorDetail(telemetry?.error, t) ??
        link.detail
  const processStep =
    progress.find((step) => step.status === 'running') ??
    progress.find((step) => step.status === 'error') ??
    null
  const processStatus = processStep?.status ?? 'idle'
  const processText = processStep?.detail ?? processStep?.label ?? ''
  const showProcessBadge = processStatus === 'running' || processStatus === 'error'

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgb(15_23_42/0.05)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em] text-slate-950">
            {exo.telemetryTitle}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showProcessBadge ? (
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-extrabold',
                processStatus === 'running' && 'bg-blue-100 text-blue-700',
                processStatus === 'error' && 'bg-red-100 text-red-700',
              )}
            >
              <span className="grid h-4 w-4 place-items-center text-[13px] leading-none">
                {stepIcon(processStatus)}
              </span>
              {processText}
            </span>
          ) : null}
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-extrabold',
              link.tone === 'connected' && 'bg-emerald-100 text-emerald-700',
              link.tone === 'waiting' && 'bg-amber-100 text-amber-800',
              link.tone === 'lost' && 'bg-red-100 text-red-700',
              link.tone === 'unavailable' && 'bg-red-100 text-red-700',
            )}
          >
            <Icon name="wifi" className="h-4 w-4" />
            {link.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 max-[1180px]:grid-cols-2 max-[680px]:grid-cols-1">
        <InfoCard label="Session State">
          <div className="text-[26px] font-extrabold text-slate-950">{sessionState}</div>
        </InfoCard>
        <InfoCard label="Gait Phase">
          <div className="text-[26px] font-extrabold text-slate-950">
            {telemetry?.gaitPhaseName ?? 'Idle'}
          </div>
        </InfoCard>
        <InfoCard label="Step Index">
          <div className="text-[26px] font-extrabold text-slate-950">
            {telemetry?.stepIdx ?? 0}
          </div>
        </InfoCard>
        <InfoCard label="Link Age">
          <div
            className={cn(
              'text-[26px] font-extrabold',
              (telemetry?.linkAgeMs ?? 9999) > 500 ? 'text-red-600' : 'text-emerald-600',
            )}
          >
            {formatMs(telemetry?.linkAgeMs ?? 9999)} ms
          </div>
        </InfoCard>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 max-[680px]:grid-cols-1">
        <LevelPairCard
          title={exo.assistPairTitle}
          hint={exo.assistPairHint}
          leftLabel={exo.sideLeft}
          rightLabel={exo.sideRight}
          left={telemetry?.assistL ?? 0}
          right={telemetry?.assistR ?? 0}
          leftColor="#7c3aed"
          rightColor="#0ea5e9"
        />
        <LevelPairCard
          title={exo.amplitudePairTitle}
          hint={exo.amplitudePairHint}
          leftLabel={exo.sideLeft}
          rightLabel={exo.sideRight}
          left={telemetry?.ampL ?? 0}
          right={telemetry?.ampR ?? 0}
          leftColor="#8b5cf6"
          rightColor="#2563eb"
        />
      </div>

      <div className="mt-4">
        <LiveJointTelemetryChart history={history} windowSeconds={windowSeconds} />
      </div>

      <div className="mt-4">
        <InfoCard label="Error Message">
          <div className={cn('text-[16px] font-extrabold', errorDetail ? 'text-red-600' : 'text-slate-500')}>
            {errorDetail ?? exo.errorNone}
          </div>
        </InfoCard>
      </div>
    </section>
  )
}

export function ExoskeletonControl() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [profileDialogMode, setProfileDialogMode] = useState<'edit' | 'start'>('start')
  const [activePatient, setActivePatient] = useState<Patient | null>(null)
  const [activeProfile, setActiveProfile] = useState<GaitProfile | null>(null)
  const [progress, setProgress] = useState<ProgressStep[]>(initialProgress)
  const [sessionState, setSessionState] = useState<SessionState>('Idle')
  const [busy, setBusy] = useState(false)
  const [, setLastResponse] = useState<SessionActionResponse | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [telemetryFlags, setTelemetryFlags] = useState<ExoskeletonControlFlags>({
    estop: false,
    running: false,
    error: null,
  })
  const onTelemetryFlagsChange = useCallback((next: ExoskeletonControlFlags) => {
    setTelemetryFlags((prev) =>
      prev.estop === next.estop && prev.running === next.running && prev.error === next.error
        ? prev
        : next,
    )
  }, [])

  useEffect(() => {
    setPatientsLoading(true)
    listPatients()
      .then(setPatients)
      .catch(() => setPatients(fallbackPatients))
      .finally(() => setPatientsLoading(false))
  }, [])

  const runSessionAction = async (
    action: 'start' | 'stop',
    body?: {
      patientId: string
      profileJson?: string
      anthropometrics?: SessionAnthropometrics
    },
  ) => {
    const payload =
      action === 'start'
        ? await startRecordingSession(body!)
        : await stopRecordingSession()
    if (!payload.success) {
      throw new Error(payload.message || 'Request failed')
    }
    setLastResponse(payload)
    return payload
  }

  const updateStep = (id: ProgressStepId, status: StepStatus, detail?: string) => {
    setProgress((current) => setStep(current, id, status, detail))
  }

  const openStartDialog = () => {
    setProfileDialogMode('start')
    setProfileDialogOpen(true)
  }

  const openEditProfileDialog = () => {
    if (!activePatient || !activeProfile || busy || workflowState === 'estop') return
    setProfileDialogMode('edit')
    setProfileDialogOpen(true)
  }

  // Logging-only: start/stop opens a Gressus session and rosbag recording.
  const startSession = async (
    patient: Patient,
    profile: GaitProfile,
    anthropometrics?: SessionAnthropometrics,
  ) => {
    setProfileDialogOpen(false)
    setBusy(true)
    setLastError(null)
    setLastResponse(null)
    setSessionState('Idle')
    setProgress(initialProgress)
    setActivePatient(patient)
    setActiveProfile(profile)
    let currentStep: ProgressStepId = 'gait'

    try {
      updateStep('arm', 'success', 'Control skipped')
      updateStep('profile', 'success', 'Profile recorded')

      currentStep = 'configuration'
      updateStep('configuration', 'running', 'Preparing recording...')
      updateStep('configuration', 'success', 'Recording ready')

      currentStep = 'gait'
      updateStep('gait', 'running', 'Starting session recording...')
      await runSessionAction('start', {
        patientId: patient.id,
        profileJson: profile.profileJson,
        anthropometrics,
      })
      updateStep('gait', 'success', 'Recording started')
      setSessionState('Running')

      updateStep('baseline', 'success', 'Baseline skipped')

      updateStep('running', 'success', 'Session recording')
    } catch (err) {
      updateStep(currentStep, 'error')
      setSessionState('Error')
      setLastError(err instanceof Error ? err.message : 'Session start failed')
    } finally {
      setBusy(false)
    }
  }

  const updateActiveProfile = async (patient: Patient, profile: GaitProfile) => {
    setProfileDialogOpen(false)
    setBusy(true)
    setLastError(null)
    setLastResponse(null)
    const wasRunning = sessionState === 'Running'

    try {
      updateStep('profile', 'success', 'Profile updated')
      setActivePatient(patient)
      setActiveProfile(profile)
      setSessionState((current) => {
        if (wasRunning) return 'Running'
        return current === 'Loading Profile' ? 'Ready' : current
      })
    } catch (err) {
      updateStep('profile', 'error')
      setSessionState('Error')
      setLastError(err instanceof Error ? err.message : 'Profile update failed')
    } finally {
      setBusy(false)
    }
  }

  const stopSession = async () => {
    setBusy(true)
    setLastError(null)
    setLastResponse(null)

    try {
      updateStep('stopped', 'running', 'Stopping session...')
      await runSessionAction('stop')
      updateStep('stopped', 'success', 'Session stopped')
      setSessionState('Idle')
      setActivePatient(null)
      setActiveProfile(null)
    } catch (err) {
      updateStep('stopped', 'error')
      setSessionState('Error')
      setLastError(err instanceof Error ? err.message : 'Stop session failed')
    } finally {
      setBusy(false)
    }
  }

  const acknowledgeEstop = () => {
    setLastError(null)
    setSessionState('Idle')
    setActivePatient(null)
    setActiveProfile(null)
    setProgress(initialProgress)
  }

  const workflowState: WorkflowState = telemetryFlags.estop
    ? 'estop'
    : lastError || sessionState === 'Error'
      ? 'error'
      : sessionState === 'Running' || telemetryFlags.running
        ? 'running'
        : 'initial'
  const retryTitle = lastError?.toLowerCase().includes('connected') ? 'Resolve Error' : 'Retry'
  const primaryAction =
    workflowState === 'estop'
      ? {
          icon: 'refresh' as IconName,
          title: 'Reset E-STOP',
          subtitle: 'Clear emergency stop',
          onClick: acknowledgeEstop,
          variant: 'danger' as const,
        }
      : workflowState === 'error'
        ? {
            icon: 'refresh' as IconName,
            title: retryTitle,
            subtitle:
              retryTitle === 'Resolve Error'
                ? 'Check device connection, then retry'
                : 'Start the session again',
            onClick: openStartDialog,
            variant: 'primary' as const,
          }
        : workflowState === 'running'
          ? {
              icon: 'stop' as IconName,
              title: 'Stop Session',
              subtitle: 'Stop recording',
              onClick: stopSession,
              variant: 'danger' as const,
            }
          : {
              icon: 'play' as IconName,
              title: 'Start Session',
              subtitle: 'Select patient and start recording',
              onClick: openStartDialog,
              variant: 'primary' as const,
            }

  const showSessionContext = workflowState === 'running' || workflowState === 'error'
  const patientLabel = activePatient?.display_name ?? 'No patient'
  const statusLabel = workflowState === 'running' ? 'Recording' : 'Error'

  return (
    <div className="mx-auto grid w-full max-w-[1540px] gap-5 text-[#17213b]">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-[0_18px_50px_rgb(15_23_42/0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em] text-slate-950">
              Session Workflow
            </h1>

            {workflowState === 'estop' ? (
              <div className="mt-3 flex items-start gap-2 text-red-800">
                <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="text-[15px] font-extrabold">Emergency stop is active</div>
                  <p className="m-0 mt-1 text-sm font-semibold text-red-700">
                    Reset E-STOP before continuing.
                  </p>
                </div>
              </div>
            ) : null}

            {workflowState === 'error' ? (
              <p className="m-0 mt-2 text-sm font-semibold leading-6 text-red-700">
                {lastError ?? telemetryFlags.error ?? 'The system reported an error.'}
              </p>
            ) : null}

            {workflowState === 'initial' ? (
              <p className="m-0 mt-2 text-sm font-semibold leading-6 text-slate-500">
                Start a session to begin recording.
              </p>
            ) : null}

            {showSessionContext ? (
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className="m-0 text-[15px] font-extrabold text-slate-950">
                  {patientLabel}
                  <span className="font-semibold text-slate-400"> · </span>
                  <span className="font-semibold text-slate-600">{statusLabel}</span>
                </p>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold text-slate-700">
                    {activeProfile?.name ?? 'No profile loaded'}
                  </span>
                  {activeProfile ? (
                    <button
                      type="button"
                      className="border-0 bg-transparent p-0 text-sm font-bold text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={busy}
                      onClick={openEditProfileDialog}
                    >
                      Edit
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <PrimaryAction
            icon={primaryAction.icon}
            title={busy ? 'Working...' : primaryAction.title}
            subtitle={primaryAction.subtitle}
            disabled={busy}
            variant={primaryAction.variant}
            onClick={() => void primaryAction.onClick()}
          />
        </div>
      </section>

      <SimplifiedTelemetry
        onFlagsChange={onTelemetryFlagsChange}
        progress={progress}
        sessionState={sessionState}
      />

      {profileDialogOpen ? (
        <ProfileDialog
          confirmLabel={profileDialogMode === 'edit' ? 'Обновить профиль' : 'Подтвердить и загрузить'}
          includeAnthropometrics={profileDialogMode === 'start'}
          initialPatientId={profileDialogMode === 'edit' ? activePatient?.id : null}
          initialProfile={profileDialogMode === 'edit' ? activeProfile : null}
          loading={patientsLoading || busy}
          patients={patients}
          onClose={() => setProfileDialogOpen(false)}
          onConfirm={(patient, profile, anthropometrics) =>
            void (profileDialogMode === 'edit'
              ? updateActiveProfile(patient, profile)
              : startSession(patient, profile, anthropometrics))
          }
          title={profileDialogMode === 'edit' ? 'Редактировать профиль' : 'Начать сессию'}
        />
      ) : null}
    </div>
  )
}
