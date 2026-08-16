import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { useI18n } from '@/i18n/context'
import type { PatientSessionWorkflow } from '@/hooks/usePatientSessionWorkflow'
import type { Patient, PatientCreate } from '@/types/patients'
import { patientAgeYears } from '@/lib/patient/display'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { PatientForm } from './PatientForm'
import { PatientStatsStrip } from './PatientStatsStrip'

type PatientHeaderProps = {
  patient: Patient
  workflow: PatientSessionWorkflow
  showActiveSession?: boolean
  className?: string
}

export function PatientHeader({
  patient,
  workflow,
  showActiveSession = false,
  className,
}: PatientHeaderProps) {
  const { t } = useI18n()
  const [editOpen, setEditOpen] = useState(false)

  const age = patient.date_of_birth ? patientAgeYears(patient.date_of_birth) : null
  const activeSession = workflow.activeSession
  const cpType = patient.cp_type?.trim()
  const gmfcs = patient.gmfcs_current?.trim()
  const disabled = workflow.pendingAction || workflow.patientLocked

  const subtitleParts: string[] = []
  if (age != null) subtitleParts.push(t.workflow.patientAgeYears(age))
  if (cpType) subtitleParts.push(cpType)

  const handleEditSubmit = async (data: PatientCreate) => {
    await workflow.updatePatient(patient.id, data)
    setEditOpen(false)
  }

  const handleNewSession = async () => {
    if (workflow.activeSession) return
    await workflow.startSession()
  }

  return (
    <div className={cn('border-b border-border', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 pb-4">
        <div className="min-w-0 flex-1 space-y-1.5">
            <p className="page-eyebrow">{t.workflow.patientEyebrow}</p>
            <h1 className="m-0 truncate text-[28px] font-semibold tracking-[-0.03em] text-foreground">
              {patient.display_name}
            </h1>

            {subtitleParts.length > 0 ? (
              <p className="m-0 text-sm font-normal text-muted-foreground">{subtitleParts.join(' · ')}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {gmfcs ? (
                <Badge className="border-0 bg-emerald-600 px-2 py-0 font-bold text-white hover:bg-emerald-600">
                  GMFCS {gmfcs}
                </Badge>
              ) : null}
              {patient.consent_on_file ? (
                <Badge className="border-0 bg-emerald-100 px-2 py-0 font-semibold text-emerald-800 hover:bg-emerald-100">
                  ✓ {t.workflow.consentOnFile}
                </Badge>
              ) : (
                <Badge variant="outline" className="px-2 py-0 font-medium text-slate-600">
                  {t.workflow.consentMissing}
                </Badge>
              )}
            </div>

            {showActiveSession && activeSession ? (
              <p className="m-0 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{t.workflow.activeSession}: </span>
                {t.workflow.sessionNumber(activeSession.session_number ?? 0)} · {t.workflow.statusActive}
              </p>
            ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            disabled={disabled}
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-4" />
            {t.workflow.editPatient}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 gap-1.5"
            disabled={disabled || Boolean(workflow.activeSession)}
            onClick={() => void handleNewSession()}
          >
            <Plus className="size-4" strokeWidth={2.5} />
            {t.workflow.newSession}
          </Button>
        </div>
      </div>

      <PatientStatsStrip
        patient={patient}
        sessions={workflow.sessions}
        activeSessionId={activeSession?.id ?? null}
      />

      <PatientForm
        open={editOpen}
        mode="edit"
        initial={patient}
        pending={workflow.pendingAction}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEditSubmit}
      />
    </div>
  )
}
