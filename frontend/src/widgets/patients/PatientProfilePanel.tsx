import type { ReactNode } from 'react'
import { useI18n } from '@/i18n/context'
import type { Patient } from '@/types/patients'
import { formatPatientDateLong } from '@/lib/patient/display'
import { cn } from '@/shared/lib/utils'

type PatientProfilePanelProps = {
  patient: Patient
  className?: string
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border py-2.5 last:border-b-0 sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="field-label">{label}</dt>
      <dd className="field-value m-0 whitespace-pre-wrap">{children}</dd>
    </div>
  )
}

function valueOrDash(value: string | null | undefined, fallback: string): ReactNode {
  const text = value?.trim()
  if (!text) return <span className="font-normal text-slate-400">{fallback}</span>
  return text
}

export function PatientProfilePanel({ patient, className }: PatientProfilePanelProps) {
  const { t, language } = useI18n()
  const dash = t.workflow.notSpecified

  return (
    <div className={cn('space-y-4', className)}>
      <section>
        <h2 className="section-title mb-1">{t.workflow.sectionClinical}</h2>
        <dl className="m-0">
          <Field label={t.workflow.comorbidities}>
            {valueOrDash(patient.comorbidities, dash)}
          </Field>
          <Field label={t.workflow.contraindications}>
            {valueOrDash(patient.contraindications, dash)}
          </Field>
        </dl>
      </section>

      <section>
        <h2 className="section-title mb-1">{t.workflow.sectionConsent}</h2>
        <dl className="m-0">
          <Field label={t.workflow.enrollmentDate}>
            {patient.enrollment_date
              ? formatPatientDateLong(patient.enrollment_date, language)
              : valueOrDash(null, dash)}
          </Field>
          <Field label={t.workflow.guardianContact}>
            {valueOrDash(patient.guardian_contact, dash)}
          </Field>
        </dl>
      </section>
    </div>
  )
}
