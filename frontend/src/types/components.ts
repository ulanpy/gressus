import type { FootFrame, FootSide, FramePayload, FootSilhouette, FootDashboard } from './insole'
import type { SourceMode } from './insole'
import type { ViewMode, TherapistSection } from './navigation'
import type { Language } from './i18n'
import type { GameLaunchParams, RuntimePayload } from './runtime'
import type { ProgressSummary, SessionMetrics, TherapyRecommendation } from '../progressAnalytics'
import type { CemrrProgressState } from '../hooks/useCemrrProgress'
import type { PatientSessionWorkflow } from '../hooks/usePatientSessionWorkflow'

export type MetricProps = {
  label: string
  value: string
  accent: string
}

export type FootPressurePanelProps = {
  side: FootSide
  frame: FootFrame
  scale: number
  showSensors: boolean
  silhouette: FootSilhouette
}

export type FootHeatmapProps = {
  frame: FootFrame
  idPrefix: string
  scale: number
  showSensors: boolean
  silhouette: FootSilhouette
  title: string
}

export type DashboardControlsProps = {
  frame: FramePayload | null
  setShowSensors: (update: (value: boolean) => boolean) => void
  setSource: (source: SourceMode) => void
  showSensors: boolean
  source: SourceMode
}

export type PageTabsProps = {
  activeView: ViewMode
  setActiveView: (view: ViewMode) => void
}

export type LanguageToggleProps = {
  language: Language
  setLanguage: (language: Language) => void
}

export type StatusSummaryProps = {
  dynamicScale: number
  source: SourceMode
  status: string
}

export type TherapistPageProps = {
  dashboard: FootDashboard
  frame: FramePayload | null
  liveInactive: boolean
  setShowSensors: (update: (value: boolean) => boolean) => void
  setSource: (source: SourceMode) => void
  showSensors: boolean
  source: SourceMode
  status: string
  cemrr: CemrrProgressState
  activeSection: TherapistSection
  setActiveSection: (section: TherapistSection) => void
}

export type ControlPageProps = {
  workflow: PatientSessionWorkflow
  runtime: RuntimePayload
  runtimeActionError: string | null
  runtimePending: boolean
  startCalibration: (params: Pick<GameLaunchParams, 'outputRotation'>) => Promise<void>
  startGame: (params: GameLaunchParams) => Promise<void>
  stopRuntime: () => Promise<void>
}

export type PatientPageProps = {
  dashboard: FootDashboard
  frame: FramePayload | null
  liveInactive: boolean
  movementMessage: string
}

export type PatientFootPanelProps = {
  frame: FootFrame
  scale: number
  side: FootSide
  silhouette: FootSilhouette
}

export type TherapistSectionTabsProps = {
  activeSection: TherapistSection
  setActiveSection: (section: TherapistSection) => void
}

export type ProgressSummaryCardsProps = {
  summary: ProgressSummary
}

export type SummaryCardProps = {
  label: string
  trend: string
  value: string
}

export type ChartProps = {
  metrics: SessionMetrics[]
}

export type ClinicalDomainsCardProps = {
  metrics: SessionMetrics[]
}

export type TherapyRecommendationsCardProps = {
  recommendations: TherapyRecommendation[]
}
