import { useState } from 'react'
import { Archive, FilePlus, MoreHorizontal, Pencil } from 'lucide-react'
import { useI18n } from '../../i18n/context'
import type { PatientSessionWorkflow } from '../../hooks/usePatientSessionWorkflow'
import type { PatientCreate } from '../../types/patients'
import { Button } from '@/shared/ui/button'
import { ConfirmModal } from '@/shared/ui/ConfirmModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { AssessmentModal } from '@/widgets/assessments/AssessmentModal'
import { PatientForm } from './PatientForm'

type PatientProfileActionsProps = {
  workflow: PatientSessionWorkflow
}

export function PatientProfileActions({ workflow }: PatientProfileActionsProps) {
  const { t } = useI18n()
  const [formOpen, setFormOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [assessmentOpen, setAssessmentOpen] = useState(false)

  const openEdit = () => {
    if (!workflow.selectedPatient) return
    setFormOpen(true)
  }

  const handleArchive = async () => {
    if (!workflow.selectedPatient) return
    await workflow.archivePatient(workflow.selectedPatient.id)
    setArchiveOpen(false)
  }

  const handleSubmit = async (data: PatientCreate) => {
    if (!workflow.selectedPatient) return
    await workflow.updatePatient(workflow.selectedPatient.id, data)
    setFormOpen(false)
  }

  const disabled = !workflow.selectedPatient || workflow.pendingAction || workflow.patientLocked

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 border-2 border-slate-300 bg-white font-semibold text-slate-800 shadow-sm"
            disabled={disabled}
            aria-label={t.workflow.patientActions}
          >
            <MoreHorizontal className="size-4" />
            <span className="hidden sm:inline">{t.workflow.patientActions}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onClick={openEdit} disabled={disabled}>
            <Pencil />
            {t.workflow.editPatient}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAssessmentOpen(true)} disabled={disabled}>
            <FilePlus />
            {t.assessment.create}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setArchiveOpen(true)}
            disabled={disabled}
          >
            <Archive />
            {t.workflow.archivePatient}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PatientForm
        open={formOpen}
        mode="edit"
        initial={workflow.selectedPatient}
        pending={workflow.pendingAction}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
      <ConfirmModal
        open={archiveOpen}
        title={t.workflow.archiveTitle}
        message={t.workflow.archiveConfirm}
        confirmLabel={t.workflow.archivePatient}
        cancelLabel={t.workflow.cancel}
        pending={workflow.pendingAction}
        onConfirm={handleArchive}
        onClose={() => setArchiveOpen(false)}
      />
      <AssessmentModal
        open={assessmentOpen}
        mode="create"
        assessment={null}
        pending={workflow.pendingAction}
        workflow={workflow}
        onClose={() => setAssessmentOpen(false)}
        onSaved={() => void workflow.refreshAssessments()}
      />
    </>
  )
}
