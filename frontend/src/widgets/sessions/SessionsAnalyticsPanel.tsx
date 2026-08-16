import type { TherapySession } from '../../types/sessions'
import { useI18n } from '@/i18n/context'
import { Calendar } from 'lucide-react'
import { AverageGaitCycleChart } from './AverageGaitCycleChart'
import { SessionAnalyticsSkeleton } from './SessionAnalyticsSkeleton'
import { SessionAnalyticsSummaryCard } from './SessionAnalyticsSummaryCard'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/ui/empty'

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
  const { t } = useI18n()
  const selectedSession =
    sessions.find((s) => s.id === selectedSessionId) ?? null

  if (sessions.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia className="bg-slate-600 text-white">
            <Calendar className="size-5 text-white" strokeWidth={2.25} />
          </EmptyMedia>
          <EmptyTitle>{t.workflow.noSessionsYet}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

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
