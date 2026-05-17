import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CSSProperties } from 'react'
import './App.css'
import {
  calculateProgressSummary,
  generateTherapyRecommendations,
  getMockSessionHistory,
  type ProgressSummary,
  type SessionMetrics,
  type TherapyRecommendation,
} from './progressAnalytics'

type SourceMode = 'live' | 'mock'
type InsoleSize = 'm' | 's'
type FootSide = 'left' | 'right'
type ViewMode = 'therapist' | 'patient'
type TherapistSection = 'live' | 'progress'
type PatientContactKey = 'both' | 'left' | 'none' | 'right'

type SensorPoint = {
  index: number
  x: number
  y: number
  xMm: number
  yMm: number
}

type PressurePoint = SensorPoint & {
  pressure: number
}

type FootStats = {
  maxKpa: number
  meanKpa: number
  sumKpa: number
  pressed: boolean
  hasData: boolean
}

type FramePayload = {
  source: SourceMode
  seq: number | string | null
  dtMs: number | null
  connected: boolean
  ageS: number | null
  error: string | null
  leftOnline: boolean
  rightOnline: boolean
  left: number[] | null
  right: number[] | null
  leftStats: FootStats
  rightStats: FootStats
}

type GeometryPayload = {
  size: InsoleSize
  sensorSideMm: number
  left: [number, number][]
  right: [number, number][]
}

type FootFrame = {
  points: PressurePoint[]
  stats: FootStats
  online: boolean
}

type FootSilhouette = {
  path: string
  edgeIndexes: number[]
}

type PathPoint = {
  x: number
  y: number
}

type MetricProps = {
  label: string
  value: string
  accent: string
}

type FootPressurePanelProps = {
  side: FootSide
  frame: FootFrame
  scale: number
  showSensors: boolean
  silhouette: FootSilhouette
}

type FootHeatmapProps = {
  frame: FootFrame
  idPrefix: string
  scale: number
  showSensors: boolean
  silhouette: FootSilhouette
  title: string
}

type DashboardControlsProps = {
  frame: FramePayload | null
  setShowSensors: (update: (value: boolean) => boolean) => void
  setSize: (size: InsoleSize) => void
  setSource: (source: SourceMode) => void
  showSensors: boolean
  size: InsoleSize
  source: SourceMode
}

type PageTabsProps = {
  activeView: ViewMode
  setActiveView: (view: ViewMode) => void
}

type StatusSummaryProps = {
  dynamicScale: number
  source: SourceMode
  status: string
}

type FootDashboard = {
  dynamicScale: number
  leftFrame: FootFrame
  leftShare: number
  leftSilhouette: FootSilhouette
  rightFrame: FootFrame
  rightSilhouette: FootSilhouette
}

type TherapistPageProps = {
  dashboard: FootDashboard
  frame: FramePayload | null
  setShowSensors: (update: (value: boolean) => boolean) => void
  setSize: (size: InsoleSize) => void
  setSource: (source: SourceMode) => void
  showSensors: boolean
  size: InsoleSize
  source: SourceMode
  status: string
}

type PatientPageProps = {
  dashboard: FootDashboard
  frame: FramePayload | null
  movementMessage: string
}

type PatientFootPanelProps = {
  frame: FootFrame
  scale: number
  side: FootSide
  silhouette: FootSilhouette
}

type PatientSuggestionState = {
  contactKey: PatientContactKey
  lastSuggestionStep: number
  message: string
  stepCount: number
}

type TherapistSectionTabsProps = {
  activeSection: TherapistSection
  setActiveSection: (section: TherapistSection) => void
}

type ProgressDashboardProps = {
  metrics: SessionMetrics[]
}

type ProgressSummaryCardsProps = {
  summary: ProgressSummary
}

type SummaryCardProps = {
  label: string
  trend: string
  value: string
}

type ChartProps = {
  metrics: SessionMetrics[]
}

type ClinicalDomainsCardProps = {
  metrics: SessionMetrics[]
}

type TherapyRecommendationsCardProps = {
  recommendations: TherapyRecommendation[]
}

const MAX_KPA = 350
const CONTACT_THRESHOLD_KPA = 8
const FOOT_CONTOUR_CORNER_RADIUS = 160
const FOOT_CONTOUR_DIP_FILL = 400
const SENSOR_COUNT = 64
const SUGGESTION_STEP_INTERVAL = 12
const PATIENT_WAITING_MESSAGE = 'Поставь стопы на дорожку'
const PRESSURE_LEVELS = {
  light: 45,
  strong: 160,
}
const FALLBACK_FOOT_PATH =
  'M50 2 C63 2 75 13 80 29 C88 54 78 88 61 97 C54 101 44 101 37 97 C20 88 12 55 20 30 C25 14 37 2 50 2 Z'

const PRESSURE_STOPS = [
  { t: 0, color: [245, 248, 252] },
  { t: 0.1, color: [100, 190, 245] },
  { t: 0.28, color: [30, 175, 155] },
  { t: 0.48, color: [255, 235, 70] },
  { t: 0.68, color: [255, 145, 35] },
  { t: 1, color: [225, 45, 30] },
] satisfies { t: number; color: [number, number, number] }[]

const tooltipStyle = {
  border: '1px solid rgb(226 232 240)',
  borderRadius: 16,
  boxShadow: '0 16px 40px rgb(15 23 42 / 0.12)',
  color: '#334155',
} satisfies CSSProperties

const FOOT_LABELS = {
  left: {
    aria: 'Left insole pressure heatmap',
    eyebrow: 'Левая стелька',
  },
  right: {
    aria: 'Right insole pressure heatmap',
    eyebrow: 'Правая стелька',
  },
} satisfies Record<FootSide, { aria: string; eyebrow: string }>

function App() {
  const [activeView, setActiveView] = useState<ViewMode>('therapist')
  const [source, setSource] = useState<SourceMode>('mock')
  const [size, setSize] = useState<InsoleSize>('m')
  const [showSensors, setShowSensors] = useState(true)
  const { geometry, setStatus, status } = useGeometry(size)
  const { frame, patientSuggestion } = useInsoleFrame(source, size, setStatus)
  const dashboard = useFootDashboard(geometry, frame)

  return (
    <main className="dashboard">
      <PageTabs activeView={activeView} setActiveView={setActiveView} />

      {activeView === 'therapist' ? (
        <TherapistPage
          dashboard={dashboard}
          frame={frame}
          setShowSensors={setShowSensors}
          setSize={setSize}
          setSource={setSource}
          showSensors={showSensors}
          size={size}
          source={source}
          status={status}
        />
      ) : (
        <PatientPage dashboard={dashboard} frame={frame} movementMessage={patientSuggestion} />
      )}
    </main>
  )
}

function PageTabs({ activeView, setActiveView }: PageTabsProps) {
  return (
    <nav className="page-tabs" aria-label="Page view">
      <button
        type="button"
        className={activeView === 'therapist' ? 'active' : ''}
        onClick={() => setActiveView('therapist')}
      >
        Therapist
      </button>
      <button
        type="button"
        className={activeView === 'patient' ? 'active' : ''}
        onClick={() => setActiveView('patient')}
      >
        Patient
      </button>
    </nav>
  )
}

function TherapistPage({
  dashboard,
  frame,
  setShowSensors,
  setSize,
  setSource,
  showSensors,
  size,
  source,
  status,
}: TherapistPageProps) {
  const [activeSection, setActiveSection] = useState<TherapistSection>('live')
  const sessionMetrics = useMemo(() => getMockSessionHistory(), [])

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Визуализатор давления Insolex</p>
          <h1>Живые и мок-карты давления стоп</h1>
          <p className="lede">
            FastAPI транслирует кадры WaveX bridge через WebSocket. Мок-режим использует ту же модель походки,
            что и Python-визуализатор, для проверки интерфейса без стелек.
          </p>
        </div>

        <StatusSummary dynamicScale={dashboard.dynamicScale} source={source} status={status} />
      </section>

      <TherapistSectionTabs activeSection={activeSection} setActiveSection={setActiveSection} />

      {activeSection === 'live' ? (
        <>
          <DashboardControls
            frame={frame}
            setShowSensors={setShowSensors}
            setSize={setSize}
            setSource={setSource}
            showSensors={showSensors}
            size={size}
            source={source}
          />

          {frame?.error && <p className="error">{frame.error}</p>}

          <section className="foot-grid">
            <FootPressurePanel
              side="left"
              frame={dashboard.leftFrame}
              scale={dashboard.dynamicScale}
              showSensors={showSensors}
              silhouette={dashboard.leftSilhouette}
            />
            <FootPressurePanel
              side="right"
              frame={dashboard.rightFrame}
              scale={dashboard.dynamicScale}
              showSensors={showSensors}
              silhouette={dashboard.rightSilhouette}
            />
          </section>

          <section className="bottom-grid">
            <div className="balance-card">
              <div>
                <p className="eyebrow">Распределение веса</p>
                <h2>
                  {dashboard.leftShare}% лево / {100 - dashboard.leftShare}% право
                </h2>
              </div>
              <div className="balance-track">
                <div style={{ width: `${dashboard.leftShare}%` }} />
              </div>
            </div>
            <div className="legend">
              <div>
                <p className="eyebrow">Шкала давления</p>
                <h2>0 - {MAX_KPA} кПа</h2>
              </div>
              <div className="legend-bar" />
            </div>
          </section>
        </>
      ) : (
        <ProgressDashboard metrics={sessionMetrics} />
      )}
    </>
  )
}

function TherapistSectionTabs({ activeSection, setActiveSection }: TherapistSectionTabsProps) {
  return (
    <section className="therapist-section-tabs" aria-label="Therapist section">
      <div className="button-group">
        <button
          type="button"
          className={activeSection === 'live' ? 'active' : ''}
          onClick={() => setActiveSection('live')}
        >
          Live Session
        </button>
        <button
          type="button"
          className={activeSection === 'progress' ? 'active' : ''}
          onClick={() => setActiveSection('progress')}
        >
          Progress Analysis
        </button>
      </div>
    </section>
  )
}

function ProgressDashboard({ metrics }: ProgressDashboardProps) {
  const summary = useMemo(() => calculateProgressSummary(metrics), [metrics])
  const recommendations = useMemo(() => generateTherapyRecommendations(metrics), [metrics])

  return (
    <section className="progress-dashboard" aria-label="Progress analysis dashboard">
      <ProgressSummaryCards summary={summary} />

      <div className="progress-grid progress-grid--charts">
        <SessionTrendChart metrics={metrics} />
        <LoadBalanceChart metrics={metrics} />
      </div>

      <div className="progress-grid progress-grid--supporting">
        <ClinicalDomainsCard metrics={metrics} />
        <TherapyRecommendationsCard recommendations={recommendations} />
      </div>

      <BaselineLatestCard summary={summary} />
    </section>
  )
}

function ProgressSummaryCards({ summary }: ProgressSummaryCardsProps) {
  return (
    <div className="summary-grid">
      <SummaryCard
        label="Overall Gait Score"
        value={`${summary.latest.gaitScore}`}
        trend={`↑ ${Math.round(summary.gaitScorePercent)}% from baseline`}
      />
      <SummaryCard
        label="Symmetry Improvement"
        value={`+${summary.symmetryChange}`}
        trend={`↑ ${Math.round(summary.symmetryPercent)}% since session 1`}
      />
      <SummaryCard
        label="Stability Improvement"
        value={`+${summary.stabilityChange}`}
        trend={`↑ ${Math.round(summary.stabilityPercent)}% since session 1`}
      />
      <SummaryCard
        label="Sessions Completed"
        value={`${summary.sessionsCompleted}`}
        trend={`${formatShortDate(summary.baseline.date)} to ${formatShortDate(summary.latest.date)}`}
      />
    </div>
  )
}

function SummaryCard({ label, value, trend }: SummaryCardProps) {
  return (
    <article className="progress-card summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{trend}</p>
    </article>
  )
}

function SessionTrendChart({ metrics }: ChartProps) {
  return (
    <article className="progress-card chart-card">
      <CardHeading eyebrow="Session Trend" title="Score trajectory" />
      <div className="chart-shell">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={metrics} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgb(226 232 240)" vertical={false} />
            <XAxis dataKey="session" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis domain={[50, 90]} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend iconType="circle" wrapperStyle={{ color: '#64748b', fontSize: 12 }} />
            <Line type="monotone" dataKey="gaitScore" name="Gait" stroke="#0891b2" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="symmetryScore" name="Symmetry" stroke="#2563eb" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="stabilityScore" name="Stability" stroke="#10b981" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}

function LoadBalanceChart({ metrics }: ChartProps) {
  return (
    <article className="progress-card chart-card">
      <CardHeading eyebrow="Left vs Right Load Balance" title="Average pressure by session" />
      <div className="chart-shell">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={metrics} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgb(226 232 240)" vertical={false} />
            <XAxis dataKey="session" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} unit=" kPa" />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend iconType="circle" wrapperStyle={{ color: '#64748b', fontSize: 12 }} />
            <Bar dataKey="leftAvgPressure" name="Left" fill="#38bdf8" radius={[8, 8, 0, 0]} />
            <Bar dataKey="rightAvgPressure" name="Right" fill="#34d399" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}

function ClinicalDomainsCard({ metrics }: ClinicalDomainsCardProps) {
  const baseline = metrics[0]
  const latest = metrics[metrics.length - 1]
  const domains = [
    {
      label: 'Symmetry',
      baseline: baseline.symmetryScore,
      latest: latest.symmetryScore,
      unit: 'score',
      improvement: percentImprovement(baseline.symmetryScore, latest.symmetryScore),
    },
    {
      label: 'Stability',
      baseline: baseline.stabilityScore,
      latest: latest.stabilityScore,
      unit: 'score',
      improvement: percentImprovement(baseline.stabilityScore, latest.stabilityScore),
    },
    {
      label: 'Load Balance',
      baseline: Math.abs(baseline.leftAvgPressure - baseline.rightAvgPressure),
      latest: Math.abs(latest.leftAvgPressure - latest.rightAvgPressure),
      unit: 'kPa gap',
      improvement: percentReduction(
        Math.abs(baseline.leftAvgPressure - baseline.rightAvgPressure),
        Math.abs(latest.leftAvgPressure - latest.rightAvgPressure),
      ),
    },
    {
      label: 'Variability',
      baseline: baseline.variabilityScore,
      latest: latest.variabilityScore,
      unit: 'index',
      improvement: percentReduction(baseline.variabilityScore, latest.variabilityScore),
    },
  ]

  return (
    <article className="progress-card">
      <CardHeading eyebrow="Clinical Domains" title="Baseline to latest" />
      <div className="domain-list">
        {domains.map((domain) => (
          <div className="domain-row" key={domain.label}>
            <div>
              <strong>{domain.label}</strong>
              <span>
                {Math.round(domain.baseline)} → {Math.round(domain.latest)} {domain.unit}
              </span>
            </div>
            <b>{formatSignedPercent(domain.improvement)}</b>
          </div>
        ))}
      </div>
    </article>
  )
}

function TherapyRecommendationsCard({ recommendations }: TherapyRecommendationsCardProps) {
  return (
    <article className="progress-card">
      <CardHeading eyebrow="Therapy Recommendations" title="Next clinical focus" />
      <div className="recommendation-list">
        {recommendations.map((recommendation) => (
          <div className="recommendation-row" key={recommendation.id}>
            <span className={`recommendation-badge recommendation-badge--${recommendation.tone}`}>
              {recommendation.badge}
            </span>
            <div>
              <strong>{recommendation.label}</strong>
              <p>{recommendation.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

function BaselineLatestCard({ summary }: { summary: ProgressSummary }) {
  const metrics = [
    { label: 'Gait score', baseline: summary.baseline.gaitScore, latest: summary.latest.gaitScore },
    { label: 'Walking speed', baseline: summary.baseline.walkingSpeed, latest: summary.latest.walkingSpeed, unit: 'm/s' },
    { label: 'Cadence', baseline: summary.baseline.cadence, latest: summary.latest.cadence, unit: 'spm' },
    { label: 'Load gap', baseline: Math.abs(summary.baseline.leftAvgPressure - summary.baseline.rightAvgPressure), latest: Math.abs(summary.latest.leftAvgPressure - summary.latest.rightAvgPressure), unit: 'kPa' },
  ]

  return (
    <article className="progress-card baseline-card">
      <CardHeading eyebrow="Baseline vs Latest" title="Key therapy markers" />
      <div className="baseline-columns">
        <ComparisonColumn title={`Session ${summary.baseline.session}`} date={summary.baseline.date} metrics={metrics} mode="baseline" />
        <ComparisonColumn title={`Session ${summary.latest.session}`} date={summary.latest.date} metrics={metrics} mode="latest" />
      </div>
    </article>
  )
}

function ComparisonColumn({
  date,
  metrics,
  mode,
  title,
}: {
  date: string
  metrics: { label: string; baseline: number; latest: number; unit?: string }[]
  mode: 'baseline' | 'latest'
  title: string
}) {
  return (
    <div className="comparison-column">
      <div>
        <span>{title}</span>
        <strong>{formatShortDate(date)}</strong>
      </div>
      {metrics.map((metric) => {
        const value = mode === 'baseline' ? metric.baseline : metric.latest

        return (
          <p key={metric.label}>
            <span>{metric.label}</span>
            <b>
              {formatMetricValue(value)}
              {metric.unit ? ` ${metric.unit}` : ''}
            </b>
          </p>
        )
      })}
    </div>
  )
}

function CardHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="card-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
  )
}

function PatientPage({ dashboard, frame, movementMessage }: PatientPageProps) {
  return (
    <>
      {frame?.error && <p className="error">Связь со стельками прервалась. Можно спокойно попробовать снова.</p>}

      <section className="patient-foot-grid">
        <PatientFootPanel
          side="left"
          frame={dashboard.leftFrame}
          scale={dashboard.dynamicScale}
          silhouette={dashboard.leftSilhouette}
        />
        <PatientFootPanel
          side="right"
          frame={dashboard.rightFrame}
          scale={dashboard.dynamicScale}
          silhouette={dashboard.rightSilhouette}
        />
      </section>

      <section className="patient-hero">
        <div>
          <p className="eyebrow">Режим пациента</p>
        </div>

        <div className="patient-message" aria-live="polite">
          <span>{frame?.connected === false ? 'Ждем сигнал' : 'Твой шаг'}</span>
          <strong>{movementMessage}</strong>
        </div>
      </section>

      <section className="patient-guide">
        <div className="patient-guide__item patient-guide__item--cool">
          <span />
          <strong>Мягкое касание</strong>
        </div>
        <div className="patient-guide__item patient-guide__item--warm">
          <span />
          <strong>Сильное касание</strong>
        </div>
        <div className="patient-guide__item patient-guide__item--calm">
          <span />
          <strong>Ровный шаг</strong>
        </div>
      </section>
    </>
  )
}

function StatusSummary({ dynamicScale, source, status }: StatusSummaryProps) {
  return (
    <div className="status-grid">
      <div className="status-card">
        <span>Источник</span>
        <strong>{source === 'mock' ? 'Мок-походка' : 'Живой TCP'}</strong>
      </div>
      <div className="status-card">
        <span>Сокет</span>
        <strong>{status}</strong>
      </div>
      <div className="status-card">
        <span>Шкала</span>
        <strong>{Math.round(dynamicScale)} кПа</strong>
      </div>
    </div>
  )
}

function DashboardControls({
  frame,
  setShowSensors,
  setSize,
  setSource,
  showSensors,
  size,
  source,
}: DashboardControlsProps) {
  return (
    <section className="controls" aria-label="Dashboard controls">
      <div className="button-group">
        <button type="button" className={source === 'mock' ? 'active' : ''} onClick={() => setSource('mock')}>
          Мок
        </button>
        <button type="button" className={source === 'live' ? 'active' : ''} onClick={() => setSource('live')}>
          Живой
        </button>
      </div>

      <label>
        Размер
        <select value={size} onChange={(event) => setSize(event.target.value as InsoleSize)}>
          <option value="m">M</option>
          <option value="s">S</option>
        </select>
      </label>

      <button type="button" className="ghost" onClick={() => setShowSensors((value) => !value)}>
        {showSensors ? 'Скрыть датчики' : 'Показать датчики'}
      </button>

      <div className="frame-meta">
        seq {frame?.seq ?? '-'} / dt {frame?.dtMs ?? '-'} мс / age{' '}
        {frame?.ageS == null ? '-' : `${frame.ageS.toFixed(2)}с`}
      </div>
    </section>
  )
}

function FootPressurePanel({ side, frame, scale, showSensors, silhouette }: FootPressurePanelProps) {
  const activeSensorCount = frame.points.filter((point) => point.pressure >= CONTACT_THRESHOLD_KPA).length
  const onlineLabel = frame.online ? 'В сети' : 'Ожидание'

  return (
    <article className="foot-card">
      <div className="foot-card__head">
        <div>
          <p className="eyebrow">{FOOT_LABELS[side].eyebrow}</p>
          <h2>{frame.stats.pressed ? 'Контакт обнаружен' : 'Карта давления'}</h2>
        </div>
        <span className={`pill ${frame.online ? 'pill--ok' : 'pill--warn'}`}>{onlineLabel}</span>
      </div>

      <div className="foot-card__body">
        <div className="foot-visual">
          <FootHeatmap
            frame={frame}
            idPrefix={`${side}-therapist`}
            scale={scale}
            showSensors={showSensors}
            silhouette={silhouette}
            title={FOOT_LABELS[side].aria}
          />
        </div>

        <div className="metrics">
          <Metric label="Пик" value={formatKpa(frame.stats.maxKpa)} accent="rose" />
          <Metric label="Среднее" value={formatKpa(frame.stats.meanKpa)} accent="cyan" />
          <Metric label="Нагрузка" value={`${Math.round(frame.stats.sumKpa / 10)} u`} accent="amber" />
          <Metric label="Датчики" value={`${activeSensorCount}/${SENSOR_COUNT}`} accent="green" />
        </div>
      </div>
    </article>
  )
}

function PatientFootPanel({ frame, scale, side, silhouette }: PatientFootPanelProps) {
  const pressureLevel = patientPressureLevel(frame)
  const statusText = patientPressureText(pressureLevel)

  return (
    <article className={`patient-foot patient-foot--${pressureLevel}`}>
      <div className="patient-foot__copy">
        <p className="eyebrow">{side === 'left' ? 'Левая стопа' : 'Правая стопа'}</p>
        <h2>{statusText}</h2>
      </div>

      <div className="patient-foot__visual">
        <FootHeatmap
          frame={frame}
          idPrefix={`${side}-patient`}
          scale={scale}
          showSensors={false}
          silhouette={silhouette}
          title={`${side === 'left' ? 'Left' : 'Right'} foot pressure picture`}
        />
      </div>
    </article>
  )
}

function FootHeatmap({ frame, idPrefix, scale, showSensors, silhouette, title }: FootHeatmapProps) {
  const clipId = `${idPrefix}-foot-clip`
  const gradientId = `${idPrefix}-foot-depth`

  return (
    <svg viewBox="0 0 100 112" role="img" aria-label={title}>
      <defs>
        <clipPath id={clipId}>
          <path d={silhouette.path} />
        </clipPath>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(248 250 252)" />
          <stop offset="100%" stopColor="rgb(226 232 240)" />
        </linearGradient>
      </defs>

      <path className="foot-outline" d={silhouette.path} fill={`url(#${gradientId})`} />
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="100" height="102" fill="rgb(248 250 252 / 0.36)" />
        {frame.points.map((point) => {
          const intensity = contrastIntensity(point.pressure / scale)

          return (
            <circle
              key={`${idPrefix}-heat-${point.index}`}
              cx={point.x}
              cy={100 - point.y}
              r={6 + intensity * 14}
              fill={pressureColor(point.pressure, scale)}
              opacity={0.04 + intensity * 0.94}
              style={{ filter: 'blur(4px)' }}
            />
          )
        })}
      </g>

      {showSensors &&
        frame.points.map((point) => {
          const active = point.pressure >= CONTACT_THRESHOLD_KPA
          const intensity = contrastIntensity(point.pressure / scale)

          return (
            <g key={`${idPrefix}-sensor-${point.index}`}>
              <circle
                cx={point.x}
                cy={100 - point.y}
                r={active ? 2.3 + intensity * 1.5 : 1.7}
                fill={active ? pressureColor(point.pressure, scale) : 'rgb(203 213 225)'}
                stroke="rgb(51 65 85 / 0.55)"
                strokeWidth="0.35"
              />
              {intensity > 0.56 && (
                <circle
                  cx={point.x}
                  cy={100 - point.y}
                  r={5.8 + intensity * 2.4}
                  fill="none"
                  stroke={pressureColor(point.pressure, scale)}
                  strokeWidth="0.8"
                  opacity="0.5"
                />
              )}
            </g>
          )
        })}
    </svg>
  )
}

function Metric({ label, value, accent }: MetricProps) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={accent}>{value}</strong>
    </div>
  )
}

function useGeometry(size: InsoleSize) {
  const [geometry, setGeometry] = useState<GeometryPayload | null>(null)
  const [status, setStatus] = useState('подключение')

  useEffect(() => {
    let ignore = false

    fetch(`/api/geometry?size=${size}`)
      .then((response) => response.json())
      .then((payload: GeometryPayload) => {
        if (!ignore) {
          setGeometry(payload)
        }
      })
      .catch(() => {
        if (!ignore) {
          setStatus('бэкенд недоступен')
        }
      })

    return () => {
      ignore = true
    }
  }, [size])

  return { geometry, setStatus, status }
}

function useInsoleFrame(
  source: SourceMode,
  size: InsoleSize,
  setStatus: React.Dispatch<React.SetStateAction<string>>,
) {
  const [frame, setFrame] = useState<FramePayload | null>(null)
  const [patientSuggestion, setPatientSuggestion] = useState(PATIENT_WAITING_MESSAGE)
  const patientSuggestionState = useRef<PatientSuggestionState>({
    contactKey: 'none',
    lastSuggestionStep: 0,
    message: PATIENT_WAITING_MESSAGE,
    stepCount: 0,
  })

  useEffect(() => {
    const ws = new WebSocket(websocketUrl(source, size))

    ws.onopen = () => setStatus('подключено')
    ws.onmessage = (event) => {
      const nextFrame = JSON.parse(event.data) as FramePayload

      setFrame(nextFrame)
      setPatientSuggestion(updatePatientSuggestion(patientSuggestionState.current, nextFrame))
      setStatus('подключено')
    }
    ws.onerror = () => setStatus('ошибка сокета')
    ws.onclose = () => setStatus('отключено')

    return () => ws.close()
  }, [setStatus, source, size])

  return { frame, patientSuggestion }
}

function useFootDashboard(geometry: GeometryPayload | null, frame: FramePayload | null): FootDashboard {
  const leftSensors = useMemo(
    () => (geometry ? buildSensorGeometry(geometry.left, geometry.sensorSideMm) : []),
    [geometry],
  )
  const rightSensors = useMemo(
    () => (geometry ? buildSensorGeometry(geometry.right, geometry.sensorSideMm) : []),
    [geometry],
  )
  const leftSilhouette = useMemo(() => buildFootSilhouette(leftSensors), [leftSensors])
  const rightSilhouette = useMemo(() => buildFootSilhouette(rightSensors), [rightSensors])
  const leftFrame = useMemo(
    () => buildFootFrame(leftSensors, frame?.left, frame?.leftStats, Boolean(frame?.leftOnline)),
    [leftSensors, frame],
  )
  const rightFrame = useMemo(
    () => buildFootFrame(rightSensors, frame?.right, frame?.rightStats, Boolean(frame?.rightOnline)),
    [rightSensors, frame],
  )
  const totalLoad = leftFrame.stats.sumKpa + rightFrame.stats.sumKpa
  const leftShare = totalLoad > 0 ? Math.round((leftFrame.stats.sumKpa / totalLoad) * 100) : 50
  const dynamicScale = Math.max(
    MAX_KPA * 0.25,
    Math.min(Math.max(leftFrame.stats.maxKpa, rightFrame.stats.maxKpa) * 1.3, MAX_KPA),
  )

  return {
    dynamicScale,
    leftFrame,
    leftShare,
    leftSilhouette,
    rightFrame,
    rightSilhouette,
  }
}

function websocketUrl(source: SourceMode, size: InsoleSize) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const params = new URLSearchParams({ source, size, threshold_kpa: String(CONTACT_THRESHOLD_KPA), hz: '50' })

  return `${protocol}//${window.location.host}/ws/insole?${params}`
}

function buildSensorGeometry(coords: [number, number][], sensorSideMm: number): SensorPoint[] {
  const xs = coords.map(([x]) => x)
  const ys = coords.map(([, y]) => y)
  const xmin = Math.min(...xs) - sensorSideMm * 2.2
  const xmax = Math.max(...xs) + sensorSideMm * 2.2
  const ymin = Math.min(...ys) - sensorSideMm * 2.2
  const ymax = Math.max(...ys) + sensorSideMm * 2.2
  const widthMm = xmax - xmin
  const heightMm = ymax - ymin
  const scale = Math.min(72 / widthMm, 96 / heightMm)
  const offsetX = 50 - (widthMm * scale) / 2
  const offsetY = 2 + (96 - heightMm * scale) / 2

  return coords.map(([xMm, yMm], index) => ({
    index,
    x: offsetX + (xMm - xmin) * scale,
    y: offsetY + (yMm - ymin) * scale,
    xMm,
    yMm,
  }))
}

function buildFootFrame(
  sensors: SensorPoint[],
  values: number[] | null | undefined,
  stats: FootStats | undefined,
  online: boolean,
): FootFrame {
  return {
    points: sensors.map((point) => ({ ...point, pressure: values?.[point.index] ?? 0 })),
    stats: stats ?? emptyStats(),
    online,
  }
}

function buildFootSilhouette(points: SensorPoint[]): FootSilhouette {
  if (points.length < 3) {
    return { path: FALLBACK_FOOT_PATH, edgeIndexes: [] }
  }

  const rows = new Map<string, SensorPoint[]>()
  for (const point of points) {
    const key = point.yMm.toFixed(3)
    rows.set(key, [...(rows.get(key) ?? []), point])
  }

  const edgePadding = 3.9
  const sections = [...rows.values()]
    .map((row) => {
      const leftEdge = row.reduce((best, point) => (point.x < best.x ? point : best), row[0])
      const rightEdge = row.reduce((best, point) => (point.x > best.x ? point : best), row[0])

      return {
        y: 100 - row[0].y,
        leftX: leftEdge.x - edgePadding,
        rightX: rightEdge.x + edgePadding,
        leftIndex: leftEdge.index,
        rightIndex: rightEdge.index,
      }
    })
    .sort((a, b) => a.y - b.y)

  sections[0] = { ...sections[0], y: sections[0].y - edgePadding }
  sections[sections.length - 1] = { ...sections[sections.length - 1], y: sections[sections.length - 1].y + edgePadding }

  const rightSide = sections.map(({ rightX, y }) => ({ x: rightX, y }))
  const leftSide = [...sections].reverse().map(({ leftX, y }) => ({ x: leftX, y }))
  const edgeIndexes = [...new Set(sections.flatMap((section) => [section.leftIndex, section.rightIndex]))]
  const outline = [...rightSide, ...leftSide].map((point) => ({
    x: clamp(point.x, 3, 97),
    y: clamp(point.y, 2, 108),
  }))
  const softened = softenConcaveDips(
    softenConcaveDips(outline, FOOT_CONTOUR_DIP_FILL),
    FOOT_CONTOUR_DIP_FILL * 0.65,
  )

  return { path: closedRoundedPath(softened, FOOT_CONTOUR_CORNER_RADIUS), edgeIndexes }
}

function closedRoundedPath(points: PathPoint[], radius: number) {
  const corners = points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length]
    const next = points[(index + 1) % points.length]

    return {
      point,
      before: pointToward(point, previous, radius),
      after: pointToward(point, next, radius),
    }
  })
  const [first, ...rest] = corners
  const segments = rest.map(
    (corner) =>
      `L ${corner.before.x.toFixed(2)} ${corner.before.y.toFixed(2)} Q ${corner.point.x.toFixed(2)} ${corner.point.y.toFixed(2)} ${corner.after.x.toFixed(2)} ${corner.after.y.toFixed(2)}`,
  )

  return `M ${first.after.x.toFixed(2)} ${first.after.y.toFixed(2)} ${segments.join(' ')} L ${first.before.x.toFixed(2)} ${first.before.y.toFixed(2)} Q ${first.point.x.toFixed(2)} ${first.point.y.toFixed(2)} ${first.after.x.toFixed(2)} ${first.after.y.toFixed(2)} Z`
}

function softenConcaveDips(points: PathPoint[], dipFill: number) {
  const strength = clamp(dipFill / 100, 0, 4)

  if (strength <= 0 || points.length < 3) {
    return points
  }

  return points.map((curr, index) => {
    const prev = points[(index - 1 + points.length) % points.length]
    const next = points[(index + 1) % points.length]

    if (!isConcaveVertex(prev, curr, next)) {
      return curr
    }

    const depth = concavityDepth(prev, curr, next)
    const localStrength = Math.min(1, strength * clamp(depth / 6, 0.35, 1))
    const ax = next.x - prev.x
    const ay = next.y - prev.y
    const len2 = ax * ax + ay * ay
    const t = clamp(((curr.x - prev.x) * ax + (curr.y - prev.y) * ay) / len2, 0, 1)
    const projX = prev.x + t * ax
    const projY = prev.y + t * ay

    return {
      x: curr.x + (projX - curr.x) * localStrength,
      y: curr.y + (projY - curr.y) * localStrength,
    }
  })
}

function isConcaveVertex(prev: PathPoint, curr: PathPoint, next: PathPoint) {
  const ax = curr.x - prev.x
  const ay = curr.y - prev.y
  const bx = next.x - curr.x
  const by = next.y - curr.y

  return ax * by - ay * bx < 0
}

function concavityDepth(prev: PathPoint, curr: PathPoint, next: PathPoint) {
  const ax = next.x - prev.x
  const ay = next.y - prev.y
  const len2 = ax * ax + ay * ay

  if (len2 < 1e-6) {
    return 0
  }

  const t = clamp(((curr.x - prev.x) * ax + (curr.y - prev.y) * ay) / len2, 0, 1)
  const projX = prev.x + t * ax
  const projY = prev.y + t * ay

  return Math.hypot(curr.x - projX, curr.y - projY)
}

function pointToward(from: PathPoint, to: PathPoint, distance: number) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const amount = Math.min(distance, length / 2) / length

  return { x: from.x + dx * amount, y: from.y + dy * amount }
}

function pressureColor(value: number, scale = MAX_KPA) {
  const t = contrastIntensity(value / scale)
  const nextIndex = PRESSURE_STOPS.findIndex((stop) => t <= stop.t)

  if (nextIndex <= 0) {
    return `rgb(${PRESSURE_STOPS[0].color.join(' ')})`
  }

  const prev = PRESSURE_STOPS[nextIndex - 1]
  const next = PRESSURE_STOPS[nextIndex]
  const amount = (t - prev.t) / Math.max(next.t - prev.t, 0.000001)

  return `rgb(${interpolateColor(prev.color, next.color, amount).join(' ')})`
}

function interpolateColor(a: number[], b: number[], amount: number) {
  return a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount))
}

function contrastIntensity(raw: number) {
  return Math.pow(clamp(raw, 0, 1), 0.68)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

function emptyStats(): FootStats {
  return { maxKpa: 0, meanKpa: 0, sumKpa: 0, pressed: false, hasData: false }
}

function formatKpa(value: number) {
  return `${Math.round(value)} kPa`
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(date))
}

function formatMetricValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function percentImprovement(baseline: number, latest: number) {
  return baseline === 0 ? 0 : ((latest - baseline) / baseline) * 100
}

function percentReduction(baseline: number, latest: number) {
  return baseline === 0 ? 0 : ((baseline - latest) / baseline) * 100
}

function formatSignedPercent(value: number) {
  const rounded = Math.round(value)

  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

function updatePatientSuggestion(state: PatientSuggestionState, frame: FramePayload) {
  const leftActive = frame.leftStats.pressed
  const rightActive = frame.rightStats.pressed
  const leftShare = patientLeftShare(frame.leftStats.sumKpa, frame.rightStats.sumKpa)
  const contactKey = patientContactKey(leftActive, rightActive)
  const immediateMessage = patientMovementMessage(leftActive, rightActive, leftShare)

  if (contactKey === 'none') {
    state.contactKey = contactKey
    state.lastSuggestionStep = state.stepCount
    state.message = immediateMessage

    return state.message
  }

  const stepCount = contactKey === state.contactKey ? state.stepCount : state.stepCount + 1
  const shouldUpdate =
    state.message === PATIENT_WAITING_MESSAGE ||
    stepCount - state.lastSuggestionStep >= SUGGESTION_STEP_INTERVAL

  state.contactKey = contactKey
  state.stepCount = stepCount

  if (shouldUpdate) {
    state.lastSuggestionStep = stepCount
    state.message = immediateMessage
  }

  return state.message
}

function patientMovementMessage(leftActive: boolean, rightActive: boolean, leftShare: number) {
  if (!leftActive && !rightActive) {
    return PATIENT_WAITING_MESSAGE
  }

  if (leftActive !== rightActive) {
    return 'Продолжай шагать спокойно'
  }

  if (leftShare > 60) {
    return 'Попробуй мягче на левую стопу'
  }

  if (leftShare < 40) {
    return 'Попробуй мягче на правую стопу'
  }

  return 'Отличный ровный шаг'
}

function patientLeftShare(leftLoad: number, rightLoad: number) {
  const totalLoad = leftLoad + rightLoad

  return totalLoad > 0 ? Math.round((leftLoad / totalLoad) * 100) : 50
}

function patientContactKey(leftActive: boolean, rightActive: boolean): PatientContactKey {
  if (leftActive && rightActive) {
    return 'both'
  }

  if (leftActive) {
    return 'left'
  }

  if (rightActive) {
    return 'right'
  }

  return 'none'
}

function patientPressureLevel(frame: FootFrame) {
  if (!frame.stats.pressed) {
    return 'waiting'
  }

  if (frame.stats.maxKpa < PRESSURE_LEVELS.light) {
    return 'light'
  }

  if (frame.stats.maxKpa > PRESSURE_LEVELS.strong) {
    return 'strong'
  }

  return 'steady'
}

function patientPressureText(level: ReturnType<typeof patientPressureLevel>) {
  switch (level) {
    case 'light':
      return 'Мягкое касание'
    case 'strong':
      return 'Сильное касание'
    case 'steady':
      return 'Хороший контакт'
    case 'waiting':
      return 'Ждет шага'
  }
}

export default App
