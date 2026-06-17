import { useState } from 'react'
import { useI18n } from '../../i18n/context'
import type { PatientSessionWorkflow } from '../../hooks/usePatientSessionWorkflow'
import { PatientForm } from './PatientForm'

type PatientSelectorProps = {
  workflow: PatientSessionWorkflow
}

export function PatientSelector({ workflow }: PatientSelectorProps) {
  const { t } = useI18n()
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')

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

  return (
    <section className="workflow-step" aria-label={t.workflow.stepPatient}>
      <header className="workflow-step__head">
        <p className="eyebrow">{t.workflow.stepPatient}</p>
        <h2>{t.workflow.selectPatient}</h2>
      </header>

      {workflow.loading ? (
        <p className="workflow-muted">{t.workflow.loading}</p>
      ) : workflow.patients.length === 0 ? (
        <p className="workflow-muted">{t.workflow.noPatients}</p>
      ) : (
        <label className="workflow-field">
          <span>{t.workflow.selectPatient}</span>
          <select
            value={workflow.selectedPatientId ?? ''}
            onChange={(e) => workflow.selectPatient(e.target.value || null)}
            disabled={workflow.pendingAction}
          >
            <option value="">{t.workflow.selectPatientPlaceholder}</option>
            {workflow.patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.display_name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="workflow-step__actions">
        <button
          type="button"
          className="workflow-btn workflow-btn--primary"
          onClick={openCreate}
          disabled={workflow.pendingAction}
        >
          {t.workflow.createPatient}
        </button>
        <button
          type="button"
          className="workflow-btn workflow-btn--secondary"
          onClick={openEdit}
          disabled={!workflow.selectedPatient || workflow.pendingAction}
        >
          {t.workflow.editPatient}
        </button>
        <button
          type="button"
          className="workflow-btn workflow-btn--danger"
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
