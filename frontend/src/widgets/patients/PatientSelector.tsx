import { useI18n } from '@/i18n/context'
import type { PatientSessionWorkflow } from '@/hooks/usePatientSessionWorkflow'
import { patientAgeYears } from '@/lib/patient/display'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'

type PatientSelectorProps = {
  workflow: PatientSessionWorkflow
  onPatientChosen?: () => void
}

export function PatientSelector({ workflow, onPatientChosen }: PatientSelectorProps) {
  const { t } = useI18n()

  if (workflow.loading) {
    return (
      <section className="surface-card px-5 py-5" aria-label={t.workflow.selectPatient}>
        <p className="m-0 text-sm text-muted-foreground">{t.workflow.loading}</p>
      </section>
    )
  }

  if (workflow.patients.length === 0) {
    return (
      <section className="surface-card px-5 py-5" aria-label={t.workflow.selectPatient}>
        <p className="m-0 text-sm text-muted-foreground">{t.workflow.noPatients}</p>
      </section>
    )
  }

  return (
    <section className="surface-card px-5 py-5" aria-label={t.workflow.selectPatient}>
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
        {workflow.patients.map((patient) => {
          const age = patient.date_of_birth ? patientAgeYears(patient.date_of_birth) : null
          const gmfcs = patient.gmfcs_current?.trim()
          const cpType = patient.cp_type?.trim()
          const meta = [
            age != null ? t.workflow.patientAgeYears(age) : null,
            cpType || null,
          ].filter(Boolean)

          return (
            <li key={patient.id}>
              <Button
                type="button"
                variant="ghost"
                disabled={workflow.pendingAction}
                onClick={() => {
                  workflow.selectPatient(patient.id)
                  onPatientChosen?.()
                }}
                className={cn(
                  'h-auto w-full flex-col items-start gap-1.5 rounded-2xl border border-border bg-white px-4 py-3 text-left font-normal whitespace-normal shadow-panel',
                  'hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <span className="flex w-full items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                    {patient.display_name}
                  </span>
                  {gmfcs ? (
                    <Badge className="border-0 bg-emerald-600 px-2 py-0 font-bold text-white hover:bg-emerald-600">
                      GMFCS {gmfcs}
                    </Badge>
                  ) : null}
                </span>
                {meta.length > 0 ? (
                  <span className="text-xs text-muted-foreground">{meta.join(' · ')}</span>
                ) : null}
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
