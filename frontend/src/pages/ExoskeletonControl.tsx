import { useEffect, useState, type ReactNode } from 'react'
import { useExoskeletonTelemetry } from '../hooks/useExoskeletonTelemetry'
import { listPatients } from '../lib/api/patients'
import { getLatestExoProfile, type LatestExoProfile } from '../lib/api/sessions'
import {
  getCalibrationStatus,
  postPgearCommand,
  type PgearCommandKey,
  type PgearCommandResponse,
} from '../lib/api/pgear'
import { cn } from '../lib/cn'
import type { ExoskeletonTelemetryFrame } from '../types/exoskeleton'
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

const mockPatients: Patient[] = ['Patient A', 'Patient B', 'Patient C'].map((name, index) => ({
  id: `mock-patient-${index + 1}`,
  display_name: name,
  date_of_birth: null,
  sex: 'unknown',
  cp_type: 'Mock gait training',
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
}))

const initialProgress: ProgressStep[] = [
  { id: 'arm', label: 'Arm complete', status: 'idle' },
  { id: 'profile', label: 'Profile loaded', status: 'idle' },
  { id: 'configuration', label: 'Configuration checked', status: 'idle' },
  { id: 'baseline', label: 'Baseline calibrated', status: 'idle' },
  { id: 'gait', label: 'Gait started', status: 'idle' },
  { id: 'running', label: 'Session running', status: 'idle' },
  { id: 'stopped', label: 'Session stopped', status: 'idle' },
]

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function createMockTelemetry(overrides: Partial<ExoskeletonTelemetryFrame> = {}): ExoskeletonTelemetryFrame {
  const seq = overrides.seq ?? 0
  const wave = Math.sin(seq / 12)
  return {
    source: 'mock',
    mode: 'mock',
    state: 'Idle',
    seq: 0,
    connected: true,
    error: null,
    gaitPhase: 0,
    gaitPhaseName: 'IDLE',
    stepIdx: 0,
    profileSlot: 0,
    version: 3,
    sensorHealthMask: 0,
    flags: 4,
    running: false,
    estop: false,
    sensorOnline: true,
    aanOn: false,
    linkAgeMs: 38,
    controllerTimeMs: 0,
    ampR: 0.5,
    ampL: 0.5,
    assistR: 0.5,
    assistL: 0.5,
    ctrlLoopUs: 7,
    linkCrcFails: 0,
    linkResyncs: 0,
    crossCheckFault: 0,
    hbErrorByte: 0,
    hbAgeMs: [0, 0, 0, 0],
    joints: [
      { name: 'HR', refPos: 0.137 + wave * 0.04, pos: 0.12 + wave * 0.03, vel: wave * 0.12, measTorque: wave * 0.25, iq: wave * 0.18, motorEffort: 0.12 },
      { name: 'KR', refPos: -0.535 - wave * 0.05, pos: -0.5 - wave * 0.04, vel: -wave * 0.11, measTorque: -wave * 0.2, iq: -wave * 0.15, motorEffort: 0.1 },
      { name: 'HL', refPos: 1.157 - wave * 0.04, pos: 1.1 - wave * 0.03, vel: -wave * 0.12, measTorque: -wave * 0.24, iq: -wave * 0.18, motorEffort: 0.12 },
      { name: 'KL', refPos: 2.99 + wave * 0.05, pos: 2.94 + wave * 0.04, vel: wave * 0.1, measTorque: wave * 0.22, iq: wave * 0.14, motorEffort: 0.1 },
    ],
    ...overrides,
  }
}

const jointLabels: Record<string, string> = {
  HR: 'Right Hip',
  KR: 'Right Knee',
  HL: 'Left Hip',
  KL: 'Left Knee',
}

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

function ClinicalGauge({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value: number
}) {
  const ratio = clampRatio(value)
  const dash = 251

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-[0_12px_30px_rgb(15_23_42/0.04)]">
      <div className="mb-3 text-[13px] font-extrabold text-slate-600">{label}</div>
      <svg viewBox="0 0 112 112" className="mx-auto h-[112px] w-[112px] -rotate-90">
        <circle cx="56" cy="56" r="40" fill="none" stroke="#e5e7eb" strokeWidth="9" />
        <circle
          cx="56"
          cy="56"
          r="40"
          fill="none"
          stroke={color}
          strokeDasharray={`${dash * ratio} ${dash}`}
          strokeLinecap="round"
          strokeWidth="9"
        />
      </svg>
      <div className="-mt-[70px] mb-8 text-[22px] font-extrabold text-slate-950">
        {value.toFixed(2)}
      </div>
      <div className="flex justify-between text-[12px] font-bold text-slate-500">
        <span>0</span>
        <span>1</span>
      </div>
    </div>
  )
}

function ConnectingTelemetry() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgb(15_23_42/0.05)]">
      <div className="grid min-h-[420px] place-items-center text-center">
        <div className="grid justify-items-center gap-5">
          <div className="relative h-24 w-24">
            <div className="absolute inset-0 rounded-full border-8 border-slate-200" />
            <div className="absolute inset-0 animate-spin rounded-full border-8 border-transparent border-t-blue-500" />
          </div>
          <div>
            <h1 className="m-0 text-[24px] font-extrabold text-slate-950">Connecting</h1>
            <p className="mt-2 mb-0 max-w-[360px] text-sm font-semibold leading-6 text-slate-500">
              Telemetry will be shown soon once the exoskeleton connection is established.
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

function JointTable({ telemetry }: { telemetry: ExoskeletonTelemetryFrame | null }) {
  const joints = telemetry?.joints ?? []

  if (!joints.length) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgb(15_23_42/0.04)]">
        <h2 className="m-0 text-[18px] font-extrabold text-slate-950">Hip / Knee Overview</h2>
        <p className="mt-2 mb-0 text-sm font-semibold text-slate-500">
          Joint telemetry will appear when available.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgb(15_23_42/0.04)]">
      <h2 className="m-0 text-[18px] font-extrabold text-slate-950">Hip / Knee Overview</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[760px] w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 text-[12px] font-extrabold text-slate-500">
              <th className="py-3">Joint</th>
              <th>Ref Pos</th>
              <th>Pos</th>
              <th>Vel</th>
              <th>Torque</th>
              <th>Iq</th>
              <th>Effort</th>
            </tr>
          </thead>
          <tbody>
            {joints.slice(0, 4).map((joint) => (
              <tr key={joint.name} className="border-b border-slate-100 last:border-b-0">
                <td className="py-3 font-extrabold text-slate-950">
                  {jointLabels[joint.name] ?? joint.name}
                </td>
                <td className="font-bold text-slate-700">{joint.refPos.toFixed(3)}</td>
                <td className="font-bold text-slate-700">{joint.pos.toFixed(3)}</td>
                <td className="font-bold text-slate-700">{joint.vel.toFixed(3)}</td>
                <td className="font-bold text-slate-700">{joint.measTorque.toFixed(3)}</td>
                <td className="font-bold text-slate-700">{joint.iq.toFixed(2)}</td>
                <td className="font-bold text-slate-700">
                  {Math.round((joint.motorEffort ?? 0) * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
        'grid min-h-[116px] grid-cols-[48px_minmax(0,1fr)] items-center gap-4 rounded-2xl border px-5 text-left text-white shadow-[0_18px_35px_rgb(15_23_42/0.18)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45',
        variant === 'danger'
          ? 'border-red-600 bg-red-600 shadow-[0_18px_40px_rgb(220_38_38/0.25)]'
          : 'border-slate-200 bg-slate-950',
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/12">
        <Icon name={icon} className="h-7 w-7 text-white" />
      </span>
      <span>
        <span className="block text-[18px] font-extrabold">{title}</span>
        <span className="mt-1 block text-[13px] font-semibold leading-5 text-white/70">
          {subtitle}
        </span>
      </span>
    </button>
  )
}

function workflowStateLabel(state: WorkflowState) {
  if (state === 'estop') return 'E-STOP'
  if (state === 'error') return 'Error'
  if (state === 'running') return 'Running'
  if (state === 'ready') return 'Ready'
  return 'Not Started'
}

function ProfileDialog({
  loading,
  mockMode,
  onClose,
  onConfirm,
  patients,
}: {
  loading: boolean
  mockMode: boolean
  onClose: () => void
  onConfirm: (patient: Patient, profile: GaitProfile) => void
  patients: Patient[]
}) {
  const availablePatients = mockMode ? mockPatients : patients.length ? patients : fallbackPatients
  const [patientId, setPatientId] = useState(availablePatients[0]?.id ?? '')
  const patient = availablePatients.find((item) => item.id === patientId) ?? availablePatients[0]
  const [lastProfile, setLastProfile] = useState<LatestExoProfile | null>(null)
  const [lastProfileLoading, setLastProfileLoading] = useState(false)
  const [params, setParams] = useState<ExoParams>(DEFAULT_EXO_PARAMS)
  const [extras, setExtras] = useState<Record<string, unknown>>({})
  const [runBaseline, setRunBaseline] = useState(true)

  useEffect(() => {
    if (mockMode || !patient) {
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
    return () => {
      cancelled = true
    }
  }, [patient?.id, mockMode])

  // Prefill the editable params from the patient's last session (or defaults).
  useEffect(() => {
    const parsed = lastProfile ? parseStoredProfile(lastProfile.profileJson) : null
    if (parsed) {
      setParams(parsed.params)
      setExtras(parsed.extras)
      setRunBaseline(!parsed.hasCoeffs)
    } else {
      setParams(DEFAULT_EXO_PARAMS)
      setExtras({})
      setRunBaseline(true)
    }
  }, [lastProfile])

  const hasStoredCoeffs = Array.isArray(extras.coeffs) && extras.coeffs.length > 0

  const buildProfileJson = (): string => {
    const { coeffs: _coeffs, meta: _meta, ...carry } = extras
    const profile: Record<string, unknown> = {
      ...carry,
      patient_id: patient?.id,
      patient_name: patient?.display_name,
      cps: params.cps,
      amp_r: params.amp_r,
      amp_l: params.amp_l,
      assist: params.assist,
    }
    // Keep previous baseline coeffs only if we are NOT re-running calibration.
    if (!runBaseline && hasStoredCoeffs) {
      profile.coeffs = extras.coeffs
    }
    return JSON.stringify(profile, null, 2)
  }

  const setParam = (key: keyof ExoParams) => (event: { target: { value: string } }) =>
    setParams((prev) => ({ ...prev, [key]: toNumber(event.target.value, prev[key]) }))

  const handleConfirm = () => {
    if (!patient) return
    onConfirm(patient, {
      id: 'exo-profile',
      name: lastProfile
        ? `Профиль (из сессии #${lastProfile.sessionNumber ?? '—'})`
        : 'Новый профиль',
      description: '',
      baselineRequired: runBaseline,
      profileJson: buildProfileJson(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-5 backdrop-blur-[2px]">
      <section className="max-h-[88vh] w-full max-w-[620px] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_28px_90px_rgb(15_23_42/0.22)]">
        <h2 className="m-0 text-[22px] font-extrabold text-slate-950">Начать сессию</h2>
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

          <label className="flex items-start gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={runBaseline}
              onChange={(event) => setRunBaseline(event.target.checked)}
            />
            <span>
              Запустить baseline-калибровку перед стартом
              {hasStoredCoeffs ? ' (иначе использовать сохранённые коэффициенты)' : ''}
            </span>
          </label>

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
            {loading ? 'Загрузка…' : 'Подтвердить и загрузить'}
          </button>
        </div>
      </section>
    </div>
  )
}

function SimplifiedTelemetry({
  activeProfileName,
  mockMode,
  progress,
  sessionState,
  telemetry,
  wsStatus,
}: {
  activeProfileName: string | null
  mockMode: boolean
  progress: ProgressStep[]
  sessionState: SessionState
  telemetry: ExoskeletonTelemetryFrame | null
  wsStatus: string
}) {
  const connected = Boolean(telemetry?.connected)
  const error = telemetry?.error
  if (!mockMode && !connected) {
    return <ConnectingTelemetry />
  }

  const processStep =
    progress.find((step) => step.status === 'running') ??
    progress.find((step) => step.status === 'error') ??
    [...progress].reverse().find((step) => step.status === 'success') ??
    null
  const processStatus = processStep?.status ?? 'idle'
  const processText = processStep?.detail ?? processStep?.label ?? 'Waiting'

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgb(15_23_42/0.05)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em] text-slate-950">
            Live Telemetry
          </h1>
          <p className="mt-1 mb-0 text-sm font-semibold text-slate-500">
            Clinical view with technical detail hidden.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-extrabold',
              processStatus === 'success' && 'bg-emerald-100 text-emerald-700',
              processStatus === 'running' && 'bg-blue-100 text-blue-700',
              processStatus === 'error' && 'bg-red-100 text-red-700',
              processStatus === 'idle' && 'bg-slate-100 text-slate-600',
            )}
          >
            <span className="grid h-4 w-4 place-items-center text-[13px] leading-none">
              {stepIcon(processStatus)}
            </span>
            {processText}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-extrabold',
              connected ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
            )}
          >
            <Icon name="wifi" className="h-4 w-4" />
            {connected ? 'Device connected' : wsStatus}
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

      <div className="mt-4 grid grid-cols-4 gap-4 max-[1180px]:grid-cols-2 max-[680px]:grid-cols-1">
        <ClinicalGauge color="#0ea5e9" label="Assist Right" value={telemetry?.assistR ?? 0} />
        <ClinicalGauge color="#7c3aed" label="Assist Left" value={telemetry?.assistL ?? 0} />
        <ClinicalGauge color="#2563eb" label="Amplitude Right" value={telemetry?.ampR ?? 0} />
        <ClinicalGauge color="#8b5cf6" label="Amplitude Left" value={telemetry?.ampL ?? 0} />
      </div>

      <div className="mt-4">
        <JointTable telemetry={telemetry} />
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 max-[760px]:grid-cols-1">
        <InfoCard label="Active Profile">
          <div className="text-[20px] font-extrabold text-slate-950">
            {activeProfileName ?? 'No profile loaded'}
          </div>
        </InfoCard>
        <InfoCard label="Error Message">
          <div className={cn('text-[16px] font-extrabold', error ? 'text-red-600' : 'text-slate-500')}>
            {error ?? 'None'}
          </div>
        </InfoCard>
      </div>
    </section>
  )
}

export function ExoskeletonControl() {
  const [mockMode, setMockMode] = useState(false)
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [activePatient, setActivePatient] = useState<Patient | null>(null)
  const [activeProfile, setActiveProfile] = useState<GaitProfile | null>(null)
  const [baselineDirty, setBaselineDirty] = useState(false)
  const [progress, setProgress] = useState<ProgressStep[]>(initialProgress)
  const [sessionState, setSessionState] = useState<SessionState>('Idle')
  const [busy, setBusy] = useState(false)
  const [, setLastResponse] = useState<PgearCommandResponse | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [mockTelemetry, setMockTelemetry] = useState<ExoskeletonTelemetryFrame>(() => createMockTelemetry())
  const { frame: realTelemetry, status: realWsStatus } = useExoskeletonTelemetry(!mockMode)
  const telemetry = mockMode ? mockTelemetry : realTelemetry
  const wsStatus = mockMode ? 'mock telemetry' : realWsStatus

  useEffect(() => {
    if (mockMode) {
      setPatients(mockPatients)
      setPatientsLoading(false)
      return
    }
    setPatientsLoading(true)
    listPatients()
      .then(setPatients)
      .catch(() => setPatients(fallbackPatients))
      .finally(() => setPatientsLoading(false))
  }, [mockMode])

  useEffect(() => {
    if (!mockMode) return
    const timer = window.setInterval(() => {
      setMockTelemetry((frame) => {
        if (frame.estop) return frame
        const running = sessionState === 'Running'
        const seq = frame.seq + 1
        const gaitPhase = running ? (seq % 4) + 1 : 0
        return createMockTelemetry({
          ...frame,
          state: sessionState,
          seq,
          connected: true,
          error: lastError,
          gaitPhase,
          gaitPhaseName: running ? ['INIT', 'GAIT', 'SWING', 'STANCE'][seq % 4] : 'IDLE',
          stepIdx: running && seq % 4 === 0 ? frame.stepIdx + 1 : frame.stepIdx,
          running,
          aanOn: running,
          flags: running ? 5 : 4,
          linkAgeMs: 34 + (seq % 5),
          controllerTimeMs: running ? frame.controllerTimeMs + 250 : frame.controllerTimeMs,
        })
      })
    }, 250)
    return () => window.clearInterval(timer)
  }, [lastError, mockMode, sessionState])

  const resetForMode = (enabled: boolean) => {
    setMockMode(enabled)
    setActivePatient(null)
    setActiveProfile(null)
    setBaselineDirty(false)
    setProgress(initialProgress)
    setSessionState('Idle')
    setBusy(false)
    setLastError(null)
    setLastResponse(null)
    setProfileDialogOpen(false)
    setMockTelemetry(createMockTelemetry())
  }

  const runPgearCommand = async (command: PgearCommandKey, body?: unknown) => {
    if (mockMode) {
      await sleep(350)
      const payload = { ok: true, success: true, message: `Mock ${command} complete` }
      setLastResponse(payload)
      return payload
    }
    const payload = await postPgearCommand(command, body)
    if (!payload.success) {
      throw new Error(payload.message || 'Command failed')
    }
    setLastResponse(payload)
    return payload
  }

  const updateStep = (id: ProgressStepId, status: StepStatus, detail?: string) => {
    setProgress((current) => setStep(current, id, status, detail))
  }

  // Baseline calibration runs async on the device (30-130 s). Poll the latched
  // status until it reaches a terminal state.
  const waitForCalibration = async () => {
    const deadline = Date.now() + 180_000
    for (;;) {
      await sleep(1000)
      const status = await getCalibrationStatus()
      updateStep(
        'baseline',
        'running',
        `Calibrating baseline… ${Math.round((status.progress ?? 0) * 100)}%`,
      )
      if (status.state === 'done') return status
      if (status.state === 'failed' || status.state === 'cancelled') {
        throw new Error(status.message || `calibration ${status.state}`)
      }
      if (Date.now() > deadline) throw new Error('Baseline calibration timed out')
    }
  }

  // Single "Start" = arm → load profile → validate → (baseline) → run gait.
  // "Stop" = stop-gait → disarm. Arm/disarm are internal and not exposed in the UI.
  const startSession = async (patient: Patient, profile: GaitProfile) => {
    setProfileDialogOpen(false)
    setBusy(true)
    setLastError(null)
    setLastResponse(null)
    setSessionState('Idle')
    setProgress(initialProgress)
    setActivePatient(patient)
    setActiveProfile(profile)
    setBaselineDirty(profile.baselineRequired)
    let currentStep: ProgressStepId = 'arm'

    try {
      currentStep = 'arm'
      if (mockMode) setSessionState('Arming')
      updateStep('arm', 'running', 'Arming motors...')
      await runPgearCommand('arm')
      updateStep('arm', 'success', 'Arming motors complete')

      currentStep = 'profile'
      if (mockMode) setSessionState('Loading Profile')
      updateStep('profile', 'running', 'Loading profile...')
      await runPgearCommand('loadProfile', { profileJson: profile.profileJson })
      updateStep('profile', 'success', 'Profile ready')

      currentStep = 'configuration'
      updateStep('configuration', 'running', 'Validating configuration...')
      if (telemetry?.connected === false) {
        throw new Error('Device is not connected.')
      }
      if (mockMode) await sleep(300)
      updateStep('configuration', 'success', 'Configuration valid')

      if (profile.baselineRequired) {
        currentStep = 'baseline'
        if (mockMode) setSessionState('Calibrating')
        updateStep('baseline', 'running', 'Calibrating baseline...')
        await runPgearCommand('calibrateBaseline', { durationS: 0 })
        if (!mockMode) await waitForCalibration()
        updateStep('baseline', 'success', 'Baseline calibrated')
      } else {
        updateStep('baseline', 'success', 'Baseline already valid')
      }
      setBaselineDirty(false)

      currentStep = 'gait'
      updateStep('gait', 'running', 'Starting gait...')
      await runPgearCommand('run', { patientId: patient.id, profileJson: profile.profileJson })
      updateStep('gait', 'success', 'Gait started')
      updateStep('running', 'success', 'Session running')
      setSessionState('Running')
      if (mockMode) {
        setMockTelemetry((frame) =>
          createMockTelemetry({
            ...frame,
            state: 'Running',
            running: true,
            gaitPhase: 2,
            gaitPhaseName: 'GAIT',
            connected: true,
            error: null,
          }),
        )
      }
    } catch (err) {
      updateStep(currentStep, 'error')
      setSessionState('Error')
      setLastError(err instanceof Error ? err.message : 'Session start failed')
    } finally {
      setBusy(false)
    }
  }

  const stopSession = async () => {
    setBusy(true)
    setLastError(null)
    setLastResponse(null)

    try {
      if (mockMode) setSessionState('Stopping')
      updateStep('stopped', 'running', 'Stopping session...')
      await runPgearCommand('stopGait')
      await runPgearCommand('disarm')
      updateStep('stopped', 'success', 'Session stopped')
      setSessionState('Idle')
      setActivePatient(null)
      setActiveProfile(null)
      setBaselineDirty(false)
      if (mockMode) {
        setMockTelemetry((frame) =>
          createMockTelemetry({
            ...frame,
            state: 'Idle',
            running: false,
            gaitPhase: 0,
            gaitPhaseName: 'IDLE',
          }),
        )
      }
    } catch (err) {
      updateStep('stopped', 'error')
      setSessionState('Error')
      setLastError(err instanceof Error ? err.message : 'Stop session failed')
    } finally {
      setBusy(false)
    }
  }

  const resetEstop = async () => {
    setBusy(true)
    setLastError(null)
    setLastResponse(null)

    try {
      updateStep('configuration', 'running', 'Resetting E-STOP...')
      await runPgearCommand('estopReset')
      updateStep('configuration', 'success', 'E-STOP reset')
      setSessionState('Idle')
      setActivePatient(null)
      setActiveProfile(null)
      setBaselineDirty(false)
      setProgress(initialProgress)
      if (mockMode) {
        setMockTelemetry((frame) =>
          createMockTelemetry({
            ...frame,
            state: 'Idle',
            estop: false,
            running: false,
            error: null,
            flags: 4,
          }),
        )
      }
    } catch (err) {
      updateStep('configuration', 'error')
      setSessionState('Error')
      setLastError(err instanceof Error ? err.message : 'E-STOP reset failed')
    } finally {
      setBusy(false)
    }
  }

  // Safety-critical: always reachable while a session is active.
  const triggerEstop = async () => {
    setBusy(true)
    setLastError(null)
    setLastResponse(null)
    try {
      await runPgearCommand('estop')
      setSessionState('E-STOP Active')
      updateStep('configuration', 'error', 'E-STOP active')
      if (mockMode) {
        setMockTelemetry((frame) =>
          createMockTelemetry({
            ...frame,
            state: 'E-STOP Active',
            estop: true,
            running: false,
            error: 'Mock E-STOP active',
            flags: 6,
          }),
        )
      }
    } catch (err) {
      setSessionState('Error')
      setLastError(err instanceof Error ? err.message : 'E-STOP failed')
    } finally {
      setBusy(false)
    }
  }

  const profileSubtitle = activePatient && activeProfile
    ? `${activePatient.display_name} · ${activeProfile.name}`
    : 'No profile loaded'
  const workflowState: WorkflowState = telemetry?.estop
    ? 'estop'
    : lastError || sessionState === 'Error'
      ? 'error'
      : sessionState === 'Running' || telemetry?.running
        ? 'running'
        : 'initial'
  const retryTitle = lastError?.toLowerCase().includes('connected') ? 'Resolve Error' : 'Retry'
  const primaryAction =
    workflowState === 'estop'
      ? {
          icon: 'refresh' as IconName,
          title: 'Reset E-STOP',
          subtitle: 'Clear the emergency stop before continuing.',
          onClick: resetEstop,
          variant: 'danger' as const,
        }
      : workflowState === 'error'
        ? {
            icon: 'refresh' as IconName,
            title: retryTitle,
            subtitle:
              retryTitle === 'Resolve Error'
                ? 'Check device connection, then start the session again.'
                : 'Start the session again.',
            onClick: () => setProfileDialogOpen(true),
            variant: 'primary' as const,
          }
        : workflowState === 'running'
          ? {
              icon: 'stop' as IconName,
              title: 'Stop Session',
              subtitle: 'Stop assisted gait and disarm the exoskeleton.',
              onClick: stopSession,
              variant: 'danger' as const,
            }
          : {
              icon: 'play' as IconName,
              title: 'Start Session',
              subtitle: 'Select patient and profile; arm, calibrate and run automatically.',
              onClick: () => setProfileDialogOpen(true),
              variant: 'primary' as const,
            }

  return (
    <div className="mx-auto grid w-full max-w-[1540px] gap-5 text-[#17213b]">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_12px_28px_rgb(15_23_42/0.04)]">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              'rounded-full px-3 py-2 text-xs font-extrabold tracking-[0.12em]',
              mockMode ? 'bg-amber-400 text-amber-950' : 'bg-emerald-100 text-emerald-700',
            )}
          >
            {mockMode ? 'MOCK MODE' : 'REAL MODE'}
          </span>
          <span className="text-sm font-semibold text-slate-500">
            {mockMode
              ? 'All exoskeleton controls and telemetry are simulated in this browser.'
              : 'Using backend API and live exoskeleton telemetry.'}
          </span>
        </div>
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            className={cn(
              'rounded-full px-4 py-2 text-sm font-extrabold',
              !mockMode ? 'bg-slate-950 text-white' : 'text-slate-600',
            )}
            onClick={() => resetForMode(false)}
          >
            Real Mode
          </button>
          <button
            type="button"
            className={cn(
              'rounded-full px-4 py-2 text-sm font-extrabold',
              mockMode ? 'bg-amber-400 text-amber-950' : 'text-slate-600',
            )}
            onClick={() => resetForMode(true)}
          >
            Mock Mode
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[430px_minmax(0,1fr)] gap-5 max-[1100px]:grid-cols-1">
        <aside className="grid content-start gap-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgb(15_23_42/0.05)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em] text-slate-950">
                  Session Workflow
                </h1>
                <p className="mt-2 mb-0 text-sm font-semibold leading-6 text-slate-500">
                  One action is shown for the current system state.
                </p>
              </div>
              <span
                className={cn(
                  'rounded-full px-3 py-2 text-xs font-extrabold',
                  workflowState === 'initial' && 'bg-slate-100 text-slate-600',
                  workflowState === 'running' && 'bg-blue-100 text-blue-700',
                  workflowState === 'error' && 'bg-red-100 text-red-700',
                  workflowState === 'estop' && 'bg-red-600 text-white',
                )}
              >
                {workflowStateLabel(workflowState)}
              </span>
            </div>

            {workflowState === 'estop' ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
                <div className="flex items-center gap-2 text-[16px] font-extrabold">
                  <Icon name="alert" className="h-5 w-5" />
                  Emergency stop is active
                </div>
                <p className="mt-2 mb-0 text-sm font-semibold leading-6">
                  Session actions are unavailable until the emergency stop is reset.
                </p>
              </div>
            ) : null}

            {workflowState === 'error' ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
                <div className="text-[13px] font-extrabold uppercase">Current error</div>
                <div className="mt-1 text-sm font-semibold leading-6">
                  {lastError ?? telemetry?.error ?? 'The system reported an error.'}
                </div>
              </div>
            ) : null}

            {(workflowState === 'running' || workflowState === 'error') && (
              <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4">
                <div>
                  <div className="text-[12px] font-extrabold uppercase text-slate-500">
                    Active patient
                  </div>
                  <div className="mt-1 text-[15px] font-extrabold text-slate-950">
                    {activePatient?.display_name ?? 'No patient selected'}
                  </div>
                </div>
                <div>
                  <div className="text-[12px] font-extrabold uppercase text-slate-500">
                    Active profile
                  </div>
                  <div className="mt-1 text-[15px] font-extrabold text-slate-950">
                    {activeProfile?.name ?? 'No profile loaded'}
                  </div>
                </div>
              </div>
            )}

            {workflowState === 'running' ? (
              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-800">
                <div className="text-[16px] font-extrabold">Session Running</div>
                <div className="mt-1 text-sm font-semibold">Assisted gait is active.</div>
              </div>
            ) : null}

            <div className="mt-5">
              <PrimaryAction
                icon={primaryAction.icon}
                title={busy ? 'Working...' : primaryAction.title}
                subtitle={primaryAction.subtitle}
                disabled={busy}
                variant={primaryAction.variant}
                onClick={() => void primaryAction.onClick()}
              />
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <div className="text-[12px] font-extrabold uppercase text-slate-500">
                Setup summary
              </div>
              <div className="mt-1 text-[15px] font-extrabold text-slate-950">
                {profileSubtitle}
              </div>
              {baselineDirty ? (
                <div className="mt-2 text-[12px] font-bold text-amber-700">
                  Baseline calibration will run before gait starts.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-red-200 bg-white p-5 shadow-[0_18px_50px_rgb(15_23_42/0.05)]">
            <h2 className="m-0 text-[14px] font-extrabold text-slate-950">Safety</h2>
            <p className="mt-1 mb-0 text-[12px] font-semibold leading-5 text-slate-500">
              Immediately cut assistance. Reset is required afterwards to start again.
            </p>
            <button
              type="button"
              className="mt-4 grid w-full place-items-center gap-1 rounded-2xl border-2 border-red-600 bg-red-600 px-4 py-5 text-white shadow-[0_12px_28px_rgb(220_38_38/0.25)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy || workflowState === 'estop'}
              onClick={() => void triggerEstop()}
            >
              <Icon name="alert" className="h-8 w-8" />
              <strong className="text-[18px] tracking-[0.08em]">E-STOP</strong>
            </button>
          </section>

        </aside>

        <div className="grid gap-5">
          <SimplifiedTelemetry
            activeProfileName={activeProfile?.name ?? null}
            mockMode={mockMode}
            progress={progress}
            sessionState={sessionState}
            telemetry={telemetry}
            wsStatus={wsStatus}
          />

          {/* <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgb(15_23_42/0.05)]">
            <h2 className="m-0 text-[18px] font-extrabold text-slate-950">Session Status</h2>
            <div className="mt-4 grid grid-cols-3 gap-4 max-[760px]:grid-cols-1">
              <InfoCard label="Device Connection">
                <div className={cn('text-xl font-extrabold', telemetry?.connected ? 'text-emerald-600' : 'text-red-600')}>
                  {telemetry?.connected ? 'Connected' : 'Disconnected'}
                </div>
              </InfoCard>
              <InfoCard label="Profile State">
                <div className="text-xl font-extrabold text-slate-950">
                  {activeProfile ? 'Ready' : 'Not loaded'}
                </div>
              </InfoCard>
              <InfoCard label="Last Message">
                <div className={cn('text-sm font-extrabold', lastError ? 'text-red-600' : 'text-slate-600')}>
                  {lastError ?? lastResponse?.message ?? 'No recent action'}
                </div>
              </InfoCard>
            </div>
          </section> */}
        </div>
      </div>

      {profileDialogOpen ? (
        <ProfileDialog
          loading={patientsLoading || busy}
          mockMode={mockMode}
          patients={patients}
          onClose={() => setProfileDialogOpen(false)}
          onConfirm={(patient, profile) => void startSession(patient, profile)}
        />
      ) : null}
    </div>
  )
}
