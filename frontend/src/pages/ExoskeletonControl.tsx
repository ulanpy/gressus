import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useExoskeletonTelemetry } from '../hooks/useExoskeletonTelemetry'
import { listPatients } from '../lib/api/patients'
import {
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

type AdvancedControl = {
  command: PgearCommandKey
  title: string
  subtitle: string
  icon: IconName
  danger?: boolean
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

const mockAdvancedControls: AdvancedControl[] = [
  {
    command: 'disarm',
    title: 'Disarm',
    subtitle: 'Disable motors and go idle',
    icon: 'unlock',
  },
  {
    command: 'stopGait',
    title: 'Stop Gait',
    subtitle: 'Stop assisted gait',
    icon: 'stop',
  },
  {
    command: 'estop',
    title: 'E-STOP',
    subtitle: 'Emergency stop immediately',
    icon: 'alert',
    danger: true,
  },
  {
    command: 'estopReset',
    title: 'E-STOP Reset',
    subtitle: 'Reset emergency stop state',
    icon: 'refresh',
  },
  {
    command: 'fullCal',
    title: 'Full Calibration',
    subtitle: 'Full calibration of motors/encoders',
    icon: 'gear',
  },
]

const initialProgress: ProgressStep[] = [
  { id: 'arm', label: 'Arm complete', status: 'idle' },
  { id: 'profile', label: 'Profile loaded', status: 'idle' },
  { id: 'configuration', label: 'Configuration checked', status: 'idle' },
  { id: 'baseline', label: 'Baseline calibrated', status: 'idle' },
  { id: 'gait', label: 'Gait started', status: 'idle' },
  { id: 'running', label: 'Session running', status: 'idle' },
  { id: 'stopped', label: 'Session stopped', status: 'idle' },
]

function profilesForPatient(patient: Patient | null, mockMode = false): GaitProfile[] {
  const patientName = patient?.display_name ?? 'Demo Patient'
  if (mockMode) {
    return [
      {
        id: 'mock-standard',
        name: 'Standard Gait Training',
        description: 'Balanced assistance for routine visual testing.',
        baselineRequired: false,
        profileJson: JSON.stringify({ patient_name: patientName, profile: 'mock_standard' }, null, 2),
      },
      {
        id: 'mock-slow',
        name: 'Slow Assisted Gait',
        description: 'Slower mock setup that requires baseline calibration.',
        baselineRequired: true,
        profileJson: JSON.stringify({ patient_name: patientName, profile: 'mock_slow_assist' }, null, 2),
      },
      {
        id: 'mock-high-assist',
        name: 'High Assistance Mode',
        description: 'High-assist mock profile for gauge and state testing.',
        baselineRequired: true,
        profileJson: JSON.stringify({ patient_name: patientName, profile: 'mock_high_assist' }, null, 2),
      },
    ]
  }
  return [
    {
      id: 'standard',
      name: 'Standard Assist',
      description: 'Balanced bilateral assistance for routine gait training.',
      baselineRequired: false,
      profileJson: JSON.stringify(
        {
          patient_id: patient?.id ?? 'demo-patient',
          patient_name: patientName,
          profile: 'standard_assist',
          assist_r: 0.5,
          assist_l: 0.5,
          amp_r: 0.5,
          amp_l: 0.5,
        },
        null,
        2,
      ),
    },
    {
      id: 'right-support',
      name: 'Right Support',
      description: 'Higher right-side assistance; baseline calibration recommended.',
      baselineRequired: true,
      profileJson: JSON.stringify(
        {
          patient_id: patient?.id ?? 'demo-patient',
          patient_name: patientName,
          profile: 'right_support',
          assist_r: 0.65,
          assist_l: 0.45,
          amp_r: 0.55,
          amp_l: 0.45,
        },
        null,
        2,
      ),
    },
    {
      id: 'low-amplitude',
      name: 'Low Amplitude',
      description: 'Reduced amplitude profile for early warm-up or cautious starts.',
      baselineRequired: true,
      profileJson: JSON.stringify(
        {
          patient_id: patient?.id ?? 'demo-patient',
          patient_name: patientName,
          profile: 'low_amplitude',
          assist_r: 0.45,
          assist_l: 0.45,
          amp_r: 0.35,
          amp_l: 0.35,
        },
        null,
        2,
      ),
    },
  ]
}

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

function MockAdvancedControlCard({
  control,
  disabled,
  mockMode,
  onClick,
  pending,
}: {
  control: AdvancedControl
  disabled: boolean
  mockMode: boolean
  onClick: () => void
  pending: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        'grid min-h-[104px] content-center justify-items-center gap-2 rounded-xl border bg-white px-2.5 py-3 text-center shadow-[0_12px_28px_rgb(15_23_42/0.04)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50',
        mockMode ? 'border-amber-200' : 'border-slate-200',
        control.danger && 'border-red-600 bg-red-600 text-white',
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon
        name={control.icon}
        className={cn('h-7 w-7', control.danger ? 'text-white' : 'text-slate-900')}
      />
      <strong className="text-[12px] leading-4">{control.title}</strong>
      <span className={cn('max-w-[96px] text-[10px] font-semibold leading-4', control.danger ? 'text-white/90' : 'text-slate-500')}>
        {pending ? 'Sending...' : control.subtitle}
      </span>
    </button>
  )
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
  const profiles = useMemo(() => profilesForPatient(patient, mockMode), [patient, mockMode])
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '')
  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0]

  useEffect(() => {
    setProfileId(profiles[0]?.id ?? '')
  }, [profiles])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-5 backdrop-blur-[2px]">
      <section className="w-full max-w-[620px] rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_28px_90px_rgb(15_23_42/0.22)]">
        <h2 className="m-0 text-[22px] font-extrabold text-slate-950">Start Session</h2>
        <p className="mt-2 mb-5 text-sm font-semibold text-slate-500">
          Select the patient and gait profile. The system will arm and load automatically.
        </p>

        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-extrabold text-slate-700">Patient</span>
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

          <label className="grid gap-2">
            <span className="text-sm font-extrabold text-slate-700">Gait profile</span>
            <select
              className="ui-select"
              value={profileId}
              onChange={(event) => setProfileId(event.target.value)}
            >
              {profiles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
            <strong className="block text-slate-950">{profile.name}</strong>
            {profile.description}
            {profile.baselineRequired ? (
              <span className="mt-2 block text-amber-700">
                Baseline calibration will run before the next session.
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-700"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-950 bg-slate-950 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-45"
            disabled={loading}
            onClick={() => onConfirm(patient, profile)}
          >
            {loading ? 'Loading...' : 'Confirm and Load'}
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
  const [lastResponse, setLastResponse] = useState<PgearCommandResponse | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastWorkflowAction, setLastWorkflowAction] = useState<'run' | 'start'>('start')
  const [pendingAdvanced, setPendingAdvanced] = useState<PgearCommandKey | null>(null)
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
    setLastWorkflowAction('start')
    setPendingAdvanced(null)
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

  const loadSelectedProfile = async (patient: Patient, profile: GaitProfile) => {
    setProfileDialogOpen(false)
    setBusy(true)
    setLastError(null)
    setLastResponse(null)
    setSessionState('Idle')
    setProgress(initialProgress)
    let currentStep: ProgressStepId = 'arm'
    setLastWorkflowAction('start')

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

      setActivePatient(patient)
      setActiveProfile(profile)
      setBaselineDirty(profile.baselineRequired)
      setSessionState('Ready')
      if (mockMode) {
        setMockTelemetry((frame) =>
          createMockTelemetry({
            ...frame,
            state: 'Ready',
            profileSlot: 0,
            connected: true,
            error: null,
          }),
        )
      }
    } catch (err) {
      updateStep(currentStep, 'error')
      setSessionState('Error')
      setLastError(err instanceof Error ? err.message : 'Profile load failed')
    } finally {
      setBusy(false)
    }
  }

  const runSession = async () => {
    setBusy(true)
    setLastError(null)
    setLastResponse(null)
    let currentStep: ProgressStepId = 'configuration'
    setLastWorkflowAction('run')
    setProgress((current) =>
      current.map((step) =>
        ['configuration', 'baseline', 'gait', 'running', 'stopped'].includes(step.id)
          ? { ...step, status: 'idle', detail: undefined }
          : step,
      ),
    )

    try {
      if (!activeProfile) {
        throw new Error('Load a patient profile before running the session.')
      }

      currentStep = 'configuration'
      updateStep('configuration', 'running', 'Checking configuration...')
      if (telemetry?.connected === false) {
        throw new Error('Device is not connected.')
      }
      if (mockMode) await sleep(250)
      updateStep('configuration', 'success', 'Configuration ready')

      if (baselineDirty) {
        currentStep = 'baseline'
        if (mockMode) setSessionState('Calibrating')
        updateStep('baseline', 'running', 'Calibrating baseline...')
        await runPgearCommand('calibrateBaseline', { durationS: 0 })
        updateStep('baseline', 'success', 'Baseline calibrated')
        setBaselineDirty(false)
      } else {
        updateStep('baseline', 'success', 'Baseline already valid')
      }

      currentStep = 'gait'
      updateStep('gait', 'running', 'Starting gait...')
      await runPgearCommand('run')
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
      updateStep('stopped', 'success', 'Session stopped')
      setSessionState(activeProfile ? 'Ready' : 'Idle')
      if (mockMode) {
        setMockTelemetry((frame) =>
          createMockTelemetry({
            ...frame,
            state: activeProfile ? 'Ready' : 'Idle',
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
      setSessionState(activeProfile ? 'Ready' : 'Idle')
      if (mockMode) {
        setMockTelemetry((frame) =>
          createMockTelemetry({
            ...frame,
            state: activeProfile ? 'Ready' : 'Idle',
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

  const runMockAdvancedControl = async (command: PgearCommandKey) => {
    if (!mockMode) return
    setPendingAdvanced(command)
    setLastError(null)
    setLastResponse(null)

    try {
      if (command === 'estop') {
        setSessionState('E-STOP Active')
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
        updateStep('configuration', 'error', 'E-STOP active')
        return
      }

      if (command === 'estopReset') {
        await resetEstop()
        return
      }

      if (command === 'stopGait') {
        if (sessionState === 'Running') {
          await stopSession()
        }
        return
      }

      if (command === 'disarm') {
        setSessionState('Idle')
        setActivePatient(null)
        setActiveProfile(null)
        setBaselineDirty(false)
        setProgress(initialProgress)
        setMockTelemetry(createMockTelemetry({ state: 'Idle' }))
        return
      }

      if (command === 'fullCal') {
        setBusy(true)
        setSessionState('Calibrating')
        updateStep('baseline', 'running', 'Full calibration...')
        await sleep(700)
        updateStep('baseline', 'success', 'Full calibration complete')
        setSessionState(activeProfile ? 'Ready' : 'Idle')
        setBusy(false)
      }
    } finally {
      setPendingAdvanced(null)
    }
  }

  const runRealAdvancedControl = async (command: PgearCommandKey) => {
    if (mockMode) return
    setPendingAdvanced(command)
    setLastError(null)
    setLastResponse(null)

    try {
      if (command === 'stopGait') {
        await stopSession()
        return
      }
      if (command === 'estopReset') {
        await resetEstop()
        return
      }
      if (command === 'fullCal') {
        setBusy(true)
        setSessionState('Calibrating')
        updateStep('baseline', 'running', 'Full calibration...')
        await runPgearCommand('fullCal')
        updateStep('baseline', 'success', 'Full calibration complete')
        setSessionState(activeProfile ? 'Ready' : 'Idle')
        setBusy(false)
        return
      }
      if (command === 'disarm') {
        await runPgearCommand('disarm')
        setSessionState('Idle')
        setActivePatient(null)
        setActiveProfile(null)
        setBaselineDirty(false)
        setProgress(initialProgress)
        return
      }
      if (command === 'estop') {
        await runPgearCommand('estop')
        setSessionState('E-STOP Active')
        updateStep('configuration', 'error', 'E-STOP active')
      }
    } catch (err) {
      setSessionState('Error')
      setLastError(err instanceof Error ? err.message : 'Advanced command failed')
    } finally {
      setBusy(false)
      setPendingAdvanced(null)
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
        : activeProfile
          ? 'ready'
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
                ? 'Check device connection, then retry the interrupted step.'
                : 'Repeat the interrupted workflow step.',
            onClick: () => {
              if (lastWorkflowAction === 'run' && activeProfile) {
                void runSession()
              } else {
                setProfileDialogOpen(true)
              }
            },
            variant: 'primary' as const,
          }
        : workflowState === 'running'
          ? {
              icon: 'stop' as IconName,
              title: 'Stop Session',
              subtitle: 'Stop assisted gait and return to ready state.',
              onClick: stopSession,
              variant: 'danger' as const,
            }
          : workflowState === 'ready'
            ? {
                icon: 'play' as IconName,
                title: 'Run Session',
                subtitle: 'Prepare automatically and start assisted gait.',
                onClick: runSession,
                variant: 'primary' as const,
              }
            : {
                icon: 'upload' as IconName,
                title: 'Start Session',
                subtitle: 'Select patient and profile; setup runs automatically.',
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
                  workflowState === 'ready' && 'bg-emerald-100 text-emerald-700',
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

            {(workflowState === 'ready' || workflowState === 'running' || workflowState === 'error') && (
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

          <section
            className={cn(
              'rounded-3xl border p-5 shadow-[0_18px_50px_rgb(15_23_42/0.05)]',
              mockMode ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-white',
            )}
          >
              <h2
                className={cn(
                  'm-0 text-[14px] font-extrabold',
                  mockMode ? 'text-amber-950' : 'text-slate-950',
                )}
              >
                Advanced Controls
              </h2>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {mockAdvancedControls.slice(0, 3).map((control) => (
                  <MockAdvancedControlCard
                    key={control.command}
                    control={control}
                    mockMode={mockMode}
                    pending={pendingAdvanced === control.command}
                    disabled={
                      busy ||
                      (Boolean(pendingAdvanced) && pendingAdvanced !== control.command) ||
                      (workflowState === 'estop' && control.command !== 'estopReset')
                    }
                    onClick={() =>
                      void (mockMode
                        ? runMockAdvancedControl(control.command)
                        : runRealAdvancedControl(control.command))
                    }
                  />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {mockAdvancedControls.slice(3).map((control) => (
                  <MockAdvancedControlCard
                    key={control.command}
                    control={control}
                    mockMode={mockMode}
                    pending={pendingAdvanced === control.command}
                    disabled={
                      busy ||
                      (Boolean(pendingAdvanced) && pendingAdvanced !== control.command) ||
                      (workflowState === 'estop' && control.command !== 'estopReset')
                    }
                    onClick={() =>
                      void (mockMode
                        ? runMockAdvancedControl(control.command)
                        : runRealAdvancedControl(control.command))
                    }
                  />
                ))}
              </div>
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

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgb(15_23_42/0.05)]">
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
          </section>
        </div>
      </div>

      {profileDialogOpen ? (
        <ProfileDialog
          loading={patientsLoading || busy}
          mockMode={mockMode}
          patients={patients}
          onClose={() => setProfileDialogOpen(false)}
          onConfirm={(patient, profile) => void loadSelectedProfile(patient, profile)}
        />
      ) : null}
    </div>
  )
}
