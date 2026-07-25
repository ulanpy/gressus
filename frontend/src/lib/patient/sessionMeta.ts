import type { TherapySession } from '@/types/sessions'

export function pickLastSession(
  sessions: TherapySession[],
  activeSessionId: string | null = null,
): TherapySession | null {
  const candidates = sessions.filter((s) => s.id !== activeSessionId)
  if (candidates.length === 0) {
    return sessions.find((s) => s.id === activeSessionId) ?? null
  }
  return [...candidates].sort(
    (a, b) => (b.session_number ?? 0) - (a.session_number ?? 0),
  )[0]
}

export function sessionDurationMinutes(session: TherapySession): number | null {
  if (!session.started_at || !session.ended_at) return null
  const ms = new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.max(1, Math.round(ms / 60_000))
}
