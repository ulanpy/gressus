import type { ReactNode } from 'react'
import { useI18n } from '@/i18n/context'
import type { Patient } from '@/types/patients'
import type { TherapySession } from '@/types/sessions'
import { formatDateOnly } from '@/lib/format'
import { pickLastSession } from '@/lib/patient/sessionMeta'
import { cn } from '@/shared/lib/utils'

type PatientStatsStripProps = {
  patient: Patient
  sessions: TherapySession[]
  activeSessionId?: string | null
  className?: string
}

function StatCell({
  icon,
  iconClass,
  label,
  value,
}: {
  icon: ReactNode
  iconClass: string
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-2.5">
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', iconClass)}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="field-label m-0 text-[12px]">{label}</p>
        <p className="field-value m-0 truncate">{value}</p>
      </div>
    </div>
  )
}

export function PatientStatsStrip({
  patient,
  sessions,
  activeSessionId = null,
  className,
}: PatientStatsStripProps) {
  const { t, language } = useI18n()
  const last = pickLastSession(sessions, activeSessionId)
  const lastDate = last?.started_at ?? last?.created_at ?? last?.session_date ?? null

  return (
    <div
      className={cn(
        'grid grid-cols-2 divide-y divide-border border-t border-border sm:grid-cols-4 sm:divide-y-0 sm:divide-x sm:divide-border',
        className,
      )}
    >
      <StatCell
        icon={
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 17 9 11l4 4 8-8" />
            <path d="M14 7h7v7" />
          </svg>
        }
        iconClass="bg-emerald-50 text-emerald-600"
        label={t.workflow.statsTotalSessions}
        value={sessions.length}
      />
      <StatCell
        icon={
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        }
        iconClass="bg-violet-50 text-violet-600"
        label={t.workflow.statsLastSession}
        value={lastDate ? formatDateOnly(lastDate, language) : t.workflow.notSpecified}
      />
      <StatCell
        icon={
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          </svg>
        }
        iconClass="bg-amber-50 text-amber-600"
        label={t.workflow.statsConsentStatus}
        value={
          patient.consent_on_file ? t.workflow.consentActive : t.workflow.consentMissing
        }
      />
      <StatCell
        icon={
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        }
        iconClass="bg-slate-100 text-slate-600"
        label={t.workflow.guardianContact}
        value={patient.guardian_contact?.trim() || t.workflow.notSpecified}
      />
    </div>
  )
}
