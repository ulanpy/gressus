import { useI18n } from '../../i18n/context'
import type { PatientSessionWorkflow } from '../../hooks/usePatientSessionWorkflow'
import {
  uiSelect,
  workflowField,
  workflowFieldLabel,
  workflowMuted,
  workflowStep,
} from '../../styles/ui'
import { PatientDemographics } from './PatientDemographics'
import { PatientProfileActions } from './PatientProfileActions'

type PatientSelectorProps = {
  workflow: PatientSessionWorkflow
}

export function PatientSelector({ workflow }: PatientSelectorProps) {
  const { t } = useI18n()

  return (
    <section className={workflowStep} aria-label={t.workflow.selectPatient}>
      {workflow.loading ? (
        <p className={workflowMuted}>{t.workflow.loading}</p>
      ) : workflow.patients.length === 0 ? (
        <p className={workflowMuted}>{t.workflow.noPatients}</p>
      ) : (
        <>
          <label className={workflowField}>
            <span className={workflowFieldLabel}>{t.workflow.selectPatient}</span>
            <select
              className={uiSelect}
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

          {workflow.selectedPatient && <PatientDemographics patient={workflow.selectedPatient} />}

          {workflow.selectedPatient && <PatientProfileActions workflow={workflow} layout="panel" />}
        </>
      )}
    </section>
  )
}
