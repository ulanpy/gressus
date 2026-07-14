import { useEffect, useRef, useState } from 'react'
import type { TherapySession } from '../../types/sessions'
import { AverageGaitCycleChart } from './AverageGaitCycleChart'
import { SessionAnalyticsSkeleton } from './SessionAnalyticsSkeleton'
import { SessionAnalyticsSummaryCard } from './SessionAnalyticsSummaryCard'
import { SessionHistoryList } from './SessionHistoryList'

type SessionsAnalyticsPanelProps = {
  sessions: TherapySession[]
  activeSessionId: string | null
  patientId: string | null
  onSessionUpdated?: (session: TherapySession) => void
}

const NARROW_MQ = '(max-width: 899px)'

function pickLatestReadyId(
  sessions: TherapySession[],
  activeSessionId: string | null,
): string | null {
  const candidates = sessions.filter(
    (s) => s.id !== activeSessionId && s.analytics_status === 'ready',
  )
  if (!candidates.length) return null
  return candidates.reduce((best, cur) =>
    (cur.session_number ?? 0) > (best.session_number ?? 0) ? cur : best,
  ).id
}

export function SessionsAnalyticsPanel({
  sessions,
  activeSessionId,
  patientId,
  onSessionUpdated,
}: SessionsAnalyticsPanelProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const skipScrollRef = useRef(true)

  useEffect(() => {
    skipScrollRef.current = true
    setSelectedSessionId(null)
  }, [patientId])

  useEffect(() => {
    if (selectedSessionId && sessions.some((s) => s.id === selectedSessionId)) {
      return
    }
    skipScrollRef.current = true
    setSelectedSessionId(pickLatestReadyId(sessions, activeSessionId))
  }, [sessions, activeSessionId, selectedSessionId])

  const selectedSession =
    sessions.find((s) => s.id === selectedSessionId) ?? null

  const selectSession = (sessionId: string) => {
    skipScrollRef.current = false
    setSelectedSessionId(sessionId)
  }

  const handleSessionUpdated = (updated: TherapySession) => {
    onSessionUpdated?.(updated)
  }

  useEffect(() => {
    if (skipScrollRef.current || !selectedSessionId || !detailRef.current) return
    if (typeof window === 'undefined') return
    if (!window.matchMedia(NARROW_MQ).matches) return
    detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedSessionId])

  return (
    <div className="mt-3 grid w-full grid-cols-1 gap-4 min-[900px]:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] min-[900px]:items-start">
      <aside className="min-w-0">
        <SessionHistoryList
          sessions={sessions}
          activeSessionId={activeSessionId}
          selectedSessionId={selectedSessionId}
          onSelectSession={selectSession}
          scrollable
        />
      </aside>

      <div ref={detailRef} className="min-w-0 scroll-mt-4">
        {selectedSession ? (
          <div className="grid gap-4">
            <SessionAnalyticsSummaryCard
              session={selectedSession}
              onSessionUpdated={handleSessionUpdated}
            />
            <AverageGaitCycleChart session={selectedSession} />
          </div>
        ) : (
          <SessionAnalyticsSkeleton />
        )}
      </div>
    </div>
  )
}
