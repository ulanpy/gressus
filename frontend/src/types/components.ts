import type { FootFrame, FootSide, FramePayload, FootSilhouette, FootDashboard } from './insole'
import type { SourceMode } from './insole'
import type { Language } from './i18n'
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
  outlineClass?: 'foot-outline' | 'garden-foot-outline'
}

export type DashboardControlsProps = {
  frame: FramePayload | null
  setShowSensors: (update: (value: boolean) => boolean) => void
  setSource: (source: SourceMode) => void
  showSensors: boolean
  source: SourceMode
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
}

export type ControlPageProps = {
  workflow: PatientSessionWorkflow
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

export type SummaryCardProps = {
  label: string
  trend: string
  value: string
}

export type ProgressSummaryCardsProps = {
  summary: {
    latest: { gaitScore: number; date: string }
    baseline: { date: string }
    symmetryChange: number
    stabilityChange: number
    sessionsCompleted: number
    gaitScorePercent: number
    symmetryPercent: number
    stabilityPercent: number
  }
}

export type ChartProps = {
  metrics: Array<{
    gaitScore: number
    symmetryScore: number
    stabilityScore: number
    leftAvgPressure: number
    rightAvgPressure: number
  }>
}

export type ClinicalDomainsCardProps = {
  metrics: ChartProps['metrics']
}

export type TherapyRecommendationsCardProps = {
  recommendations: Array<{
    id: string
    tone: 'focus' | 'steady' | 'positive'
    label?: string
    detail?: string
  }>
}
