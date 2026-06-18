import { useState } from 'react'
import { useI18n } from '../../i18n/context'
import type { PatientSessionWorkflow } from '../../hooks/usePatientSessionWorkflow'
import type { PatientCreate } from '../../types/patients'
import { IconButton, PlusIcon } from '../ui/IconButton'
import { PatientForm } from './PatientForm'

type PatientCreateActionProps = {
  workflow: PatientSessionWorkflow
}

export function PatientCreateAction({ workflow }: PatientCreateActionProps) {
  const { t } = useI18n()
  const [formOpen, setFormOpen] = useState(false)

  const handleSubmit = async (data: PatientCreate) => {
    await workflow.createPatient(data)
    setFormOpen(false)
  }

  return (
    <>
      <IconButton
        label={t.workflow.createPatient}
        variant="primary"
        onClick={() => setFormOpen(true)}
        disabled={workflow.pendingAction || workflow.patientLocked}
      >
        <PlusIcon />
      </IconButton>

      <PatientForm
        open={formOpen}
        mode="create"
        initial={null}
        pending={workflow.pendingAction}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  )
}
