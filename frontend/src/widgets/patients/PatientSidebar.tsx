import type { ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  Calendar,
  ClipboardList,
  UserRound,
} from 'lucide-react'
import { useI18n } from '@/i18n/context'
import type { Patient } from '@/types/patients'
import {
  formatPatientDateLong,
  formatPatientDateOfBirth,
  patientSexLabel,
} from '@/lib/patient/display'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { LateralityIndicator } from './LateralityIndicator'

type PatientSidebarProps = {
  patient: Patient
  className?: string
}

function KeyRow({
  icon,
  iconClass,
  label,
  children,
}: {
  icon: ReactNode
  iconClass: string
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-xl', iconClass)}>
          {icon}
        </span>
        <span className="field-label truncate">{label}</span>
      </div>
      <div className="field-value max-w-[55%] shrink-0 truncate text-right">{children}</div>
    </div>
  )
}

function NoteBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="field-label m-0 text-[11px]">{label}</p>
      <p className="m-0 whitespace-pre-wrap text-[13px] leading-snug text-slate-700">{value}</p>
    </div>
  )
}

export function PatientSidebar({ patient, className }: PatientSidebarProps) {
  const { t, language } = useI18n()
  const gmfcs = patient.gmfcs_current?.trim()
  const comorbidities = patient.comorbidities?.trim()
  const contraindications = patient.contraindications?.trim()
  const hasNotes = Boolean(
    comorbidities ||
      contraindications ||
      patient.enrollment_date,
  )

  return (
    <aside className={cn(className)}>
      <Card className="gap-0 rounded-2xl py-0 shadow-panel">
        <CardHeader className="border-b border-border px-4 py-3">
          <CardTitle className="page-eyebrow">{t.workflow.keyInfoTitle}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border px-4 py-1">
          <KeyRow
            icon={<ClipboardList className="h-3.5 w-3.5" />}
            iconClass="bg-indigo-50 text-indigo-600"
            label={t.workflow.cpType}
          >
            {patient.cp_type?.trim() || t.workflow.notSpecified}
          </KeyRow>
          <KeyRow
            icon={<Activity className="h-3.5 w-3.5" />}
            iconClass="bg-emerald-50 text-emerald-600"
            label={t.workflow.gmfcsCurrent}
          >
            {gmfcs ? (
              <Badge className="h-6 min-w-6 justify-center rounded-full border-0 bg-emerald-100 px-2 font-bold text-emerald-800 hover:bg-emerald-100">
                {gmfcs}
              </Badge>
            ) : (
              t.workflow.notSpecified
            )}
          </KeyRow>
          <KeyRow
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            iconClass="bg-amber-50 text-amber-600"
            label={t.workflow.affectedSide}
          >
            <LateralityIndicator affectedSide={patient.affected_side} variant="single" />
          </KeyRow>
          <KeyRow
            icon={<Calendar className="h-3.5 w-3.5" />}
            iconClass="bg-slate-100 text-slate-600"
            label={t.workflow.dateOfBirth}
          >
            {patient.date_of_birth
              ? formatPatientDateOfBirth(patient.date_of_birth, language)
              : t.workflow.notSpecified}
          </KeyRow>
          <KeyRow
            icon={<UserRound className="h-3.5 w-3.5" />}
            iconClass="bg-slate-100 text-slate-600"
            label={t.workflow.sex}
          >
            {patient.sex !== 'unknown'
              ? patientSexLabel(patient.sex, t.workflow)
              : t.workflow.notSpecified}
          </KeyRow>
        </CardContent>

        {hasNotes ? (
          <div className="space-y-2.5 border-t border-border px-4 py-3">
            {comorbidities ? (
              <NoteBlock label={t.workflow.comorbidities} value={comorbidities} />
            ) : null}
            {contraindications ? (
              <NoteBlock label={t.workflow.contraindications} value={contraindications} />
            ) : null}
            {patient.enrollment_date ? (
              <NoteBlock
                label={t.workflow.enrollmentDate}
                value={formatPatientDateLong(patient.enrollment_date, language)}
              />
            ) : null}
          </div>
        ) : null}
      </Card>
    </aside>
  )
}
