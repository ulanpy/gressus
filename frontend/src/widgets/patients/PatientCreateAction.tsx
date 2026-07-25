import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useI18n } from '@/i18n/context'
import type { PatientSessionWorkflow } from '@/hooks/usePatientSessionWorkflow'
import type { PatientCreate } from '@/types/patients'
import { Button } from '@/shared/ui/button'
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
      <Button
        type="button"
        size="icon"
        className="h-9 w-9 rounded-lg border-2 border-slate-900 bg-slate-900 text-white shadow-sm hover:bg-slate-800"
        aria-label={t.workflow.createPatient}
        onClick={() => setFormOpen(true)}
        disabled={workflow.pendingAction || workflow.patientLocked}
      >
        <Plus className="size-5" strokeWidth={2.5} />
      </Button>

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
