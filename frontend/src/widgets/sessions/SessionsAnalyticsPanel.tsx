import type { TherapySession } from '../../types/sessions'
import { AverageGaitCycleChart } from './AverageGaitCycleChart'
import { SessionAnalyticsSkeleton } from './SessionAnalyticsSkeleton'
import { SessionAnalyticsSummaryCard } from './SessionAnalyticsSummaryCard'

type SessionsAnalyticsPanelProps = {
  sessions: TherapySession[]
  selectedSessionId: string | null
  onSessionUpdated?: (session: TherapySession) => void
}

export function SessionsAnalyticsPanel({
  sessions,
  selectedSessionId,
  onSessionUpdated,
}: SessionsAnalyticsPanelProps) {
  const selectedSession =
    sessions.find((s) => s.id === selectedSessionId) ?? null

  if (!selectedSession) {
    return <SessionAnalyticsSkeleton compact />
  }

  return (
    <div className="grid gap-2.5">
      <SessionAnalyticsSummaryCard
        key={selectedSession.id}
        session={selectedSession}
        onSessionUpdated={onSessionUpdated}
        compact
      />
      <AverageGaitCycleChart session={selectedSession} compact />
    </div>
  )
}
