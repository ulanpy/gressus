import { formatDateOnly, formatDateTime } from '../../lib/format'
import { useI18n } from '../../i18n/context'
import { cn } from '../../lib/cn'
import type { AnalyticsStatus, TherapySession } from '../../types/sessions'
import { HistoryIcon } from '../patients/PatientFieldIcons'
import { SessionAnthropometricsLine } from './SessionAnthropometricsLine'
import { SessionStatusIcon } from './SessionStatusIcon'
import {
  sessionCardMeta,
  sessionHistory,
  sessionHistoryItem,
} from '../../styles/ui'

type SessionHistoryListProps = {
  sessions: TherapySession[]
  activeSessionId: string | null
  selectedSessionId?: string | null
  onSelectSession?: (sessionId: string) => void
  /** Cap height and scroll internally (master–detail layout). */
  scrollable?: boolean
}

function analyticsBadgeLabel(
  status: AnalyticsStatus | null | undefined,
  t: ReturnType<typeof useI18n>['t'],
): string | null {
  switch (status) {
    case 'ready':
      return t.workflow.analyticsReadyShort
    case 'pending':
    case 'processing':
      return t.workflow.analyticsPendingShort
    case 'failed':
      return t.workflow.analyticsFailedShort
    default:
      return null
  }
}

export function SessionHistoryList({
  sessions,
  activeSessionId,
  selectedSessionId = null,
  onSelectSession,
  scrollable = false,
}: SessionHistoryListProps) {
  const { t, language } = useI18n()
  const history = sessions.filter((s) => s.id !== activeSessionId)

  if (history.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-slate-500">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-indigo-500">
          <HistoryIcon />
        </div>
        <p className="m-0 text-sm font-medium">{t.workflow.noSessionHistory}</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        scrollable &&
          'scrollbar-hide max-h-[min(420px,55vh)] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/80 p-2 min-[900px]:max-h-[min(640px,70vh)]',
      )}
    >
      <ul className={cn(sessionHistory, scrollable && 'mt-0 gap-1.5')}>
        {history.map((session) => {
          const primaryDate = session.started_at ?? session.created_at
          const selected = session.id === selectedSessionId
          const analyticsLabel = analyticsBadgeLabel(session.analytics_status, t)
          const interactive = Boolean(onSelectSession)

          return (
            <li key={session.id}>
              <button
                type="button"
                className={cn(
                  sessionHistoryItem,
                  'w-full border text-left transition-colors',
                  scrollable && 'px-3 py-2.5 rounded-xl',
                  interactive ? 'cursor-pointer' : 'cursor-default',
                  selected
                    ? 'border-slate-900 bg-white shadow-[0_8px_20px_rgb(15_23_42/0.06)]'
                    : 'border-transparent hover:border-slate-200 hover:bg-white',
                )}
                disabled={!interactive}
                onClick={() => onSelectSession?.(session.id)}
              >
                <div className="flex items-center gap-2">
                  <strong className="text-sm">
                    {t.workflow.sessionNumber(session.session_number ?? 0)}
                  </strong>
                  <SessionStatusIcon status={session.status} />
                  {analyticsLabel ? (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-extrabold',
                        session.analytics_status === 'ready' && 'bg-emerald-100 text-emerald-800',
                        (session.analytics_status === 'pending' ||
                          session.analytics_status === 'processing') &&
                          'bg-amber-100 text-amber-800',
                        session.analytics_status === 'failed' && 'bg-red-100 text-red-700',
                      )}
                      title={
                        session.analytics_status === 'ready'
                          ? t.workflow.analyticsTooltipReady
                          : session.analytics_status === 'failed'
                            ? t.workflow.analyticsTooltipFailed
                            : t.workflow.analyticsTooltipPending
                      }
                    >
                      {analyticsLabel}
                    </span>
                  ) : null}
                </div>
                <div className={cn(sessionCardMeta, 'mt-1')}>
                  <span className="text-xs">
                    {primaryDate
                      ? formatDateTime(primaryDate, language)
                      : session.session_date
                        ? formatDateOnly(session.session_date, language)
                        : ''}
                  </span>
                  <SessionAnthropometricsLine
                    anthropometrics={session.anthropometrics}
                    className="block text-xs text-slate-500"
                  />
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
