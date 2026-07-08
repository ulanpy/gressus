import { useState, type ReactNode } from 'react'
import { useI18n } from '../../i18n/context'
import type { PatientSessionWorkflow } from '../../hooks/usePatientSessionWorkflow'
import type { PatientCreate } from '../../types/patients'
import { ConfirmModal } from '../ui/ConfirmModal'
import { AssessmentModal } from '../assessments/AssessmentModal'
import { ArchiveIcon, FilePlusIcon, IconButton, PencilIcon } from '../ui/IconButton'
import { workflowStepActions } from '../../styles/ui'
import { PatientForm } from './PatientForm'

type PatientProfileActionsProps = {
  workflow: PatientSessionWorkflow
  layout?: 'toolbar' | 'panel'
  children?: ReactNode
}

export function PatientProfileActions({
  workflow,
  layout = 'toolbar',
  children,
}: PatientProfileActionsProps) {
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

  const locked = workflow.patientLocked

  const editButton = (
    <IconButton
      label={t.workflow.editPatient}
      onClick={openEdit}
      disabled={!workflow.selectedPatient || workflow.pendingAction || locked}
    >
      <PencilIcon />
    </IconButton>
  )

  const archiveButton = (
    <IconButton
      label={t.workflow.archivePatient}
      variant="danger"
      onClick={() => setArchiveOpen(true)}
      disabled={!workflow.selectedPatient || workflow.pendingAction || locked}
    >
      <ArchiveIcon />
    </IconButton>
  )

  const createAssessmentButton = (
    <IconButton
      label={t.assessment.create}
      onClick={() => setAssessmentOpen(true)}
      disabled={!workflow.selectedPatient || workflow.pendingAction || locked}
    >
      <FilePlusIcon />
    </IconButton>
  )

  const modals = (
    <>
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

  if (layout === 'panel') {
    return (
      <>
        <div className={workflowStepActions}>
          {editButton}
          {createAssessmentButton}
          {archiveButton}
        </div>
        {modals}
      </>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {editButton}
        {createAssessmentButton}
        {archiveButton}
        <IconButton
  label="Start Session"
  onClick={async () => {
    try {
      await workflow.startSession()
    } catch (e) {
      console.error(e)
    }
  }}
  disabled={
    !workflow.selectedPatient ||
    workflow.pendingAction ||
    workflow.patientLocked
  }
>
  ▶
</IconButton>
        {children}
      </div>
      {modals}
    </>
  )
}
