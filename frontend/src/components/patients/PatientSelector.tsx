import { useState } from 'react'
import { useI18n } from '../../i18n/context'
import type { PatientSessionWorkflow } from '../../hooks/usePatientSessionWorkflow'
import { cn } from '../../lib/cn'
import {
  workflowBtnDanger,
  workflowBtnPrimary,
  workflowBtnSecondary,
  workflowField,
  workflowFieldInput,
  workflowFieldLabel,
  workflowMuted,
  workflowStep,
  workflowStepActions,
} from '../../styles/ui'
import { PatientForm } from './PatientForm'

type PatientSelectorProps = {
  workflow: PatientSessionWorkflow
  variant?: 'standalone' | 'inline'
}

export function PatientSelector({ workflow, variant = 'standalone' }: PatientSelectorProps) {
  const { t } = useI18n()
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const inline = variant === 'inline'

  const openCreate = () => {
    setFormMode('create')
    setFormOpen(true)
  }

  const openEdit = () => {
    if (!workflow.selectedPatient) return
    setFormMode('edit')
    setFormOpen(true)
  }

  const handleArchive = async () => {
    if (!workflow.selectedPatient) return
    if (!window.confirm(t.workflow.archiveConfirm)) return
    await workflow.archivePatient(workflow.selectedPatient.id)
  }

  const handleSubmit = async (data: Parameters<typeof workflow.createPatient>[0]) => {
    if (formMode === 'create') {
      await workflow.createPatient(data)
    } else if (workflow.selectedPatient) {
      await workflow.updatePatient(workflow.selectedPatient.id, data)
    }
    setFormOpen(false)
  }

  const selectField = (
    <label className={cn(workflowField, inline && 'mt-0 min-w-[180px]')}>
      {!inline && <span className={workflowFieldLabel}>{t.workflow.selectPatient}</span>}
      <select
        className={workflowFieldInput}
        value={workflow.selectedPatientId ?? ''}
        onChange={(e) => workflow.selectPatient(e.target.value || null)}
        disabled={workflow.pendingAction}
        aria-label={t.workflow.selectPatient}
      >
        <option value="">{t.workflow.selectPatientPlaceholder}</option>
        {workflow.patients.map((patient) => (
          <option key={patient.id} value={patient.id}>
            {patient.display_name}
          </option>
        ))}
      </select>
    </label>
  )

  if (inline) {
    return (
      <>
        {selectField}
        <button
          type="button"
          className={workflowBtnSecondary}
          onClick={openEdit}
          disabled={!workflow.selectedPatient || workflow.pendingAction}
        >
          {t.workflow.editPatient}
        </button>
        <PatientForm
          open={formOpen}
          mode={formMode}
          initial={formMode === 'edit' ? workflow.selectedPatient : null}
          pending={workflow.pendingAction}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
        />
      </>
    )
  }

  return (
    <section className={workflowStep} aria-label={t.workflow.selectPatient}>
      {workflow.loading ? (
        <p className={workflowMuted}>{t.workflow.loading}</p>
      ) : workflow.patients.length === 0 ? (
        <p className={workflowMuted}>{t.workflow.noPatients}</p>
      ) : (
        selectField
      )}

      <div className={workflowStepActions}>
        <button
          type="button"
          className={workflowBtnPrimary}
          onClick={openCreate}
          disabled={workflow.pendingAction}
        >
          {t.workflow.createPatient}
        </button>
        <button
          type="button"
          className={workflowBtnSecondary}
          onClick={openEdit}
          disabled={!workflow.selectedPatient || workflow.pendingAction}
        >
          {t.workflow.editPatient}
        </button>
        <button
          type="button"
          className={workflowBtnDanger}
          onClick={() => void handleArchive()}
          disabled={!workflow.selectedPatient || workflow.pendingAction}
        >
          {t.workflow.archivePatient}
        </button>
      </div>

      <PatientForm
        open={formOpen}
        mode={formMode}
        initial={formMode === 'edit' ? workflow.selectedPatient : null}
        pending={workflow.pendingAction}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </section>
  )
}
