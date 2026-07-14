import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/context'
import type { PatientSessionWorkflow } from '../../hooks/usePatientSessionWorkflow'
import { AssessmentSection } from '../assessments/AssessmentSection'
import { SessionsAnalyticsPanel } from '../sessions/SessionsAnalyticsPanel'
import {
  uiSelect,
  workflowField,
  workflowFieldLabel,
  workflowMuted,
  workflowStep,
} from '../../styles/ui'
import { PatientCard } from './PatientCard'
import { PatientProfileActions } from './PatientProfileActions'
import { PatientViewMenu, type PatientWorkspaceView } from './PatientViewMenu'

type PatientSelectorProps = {
  workflow: PatientSessionWorkflow
}

export function PatientSelector({ workflow }: PatientSelectorProps) {
  const { t } = useI18n()
  const [workspaceView, setWorkspaceView] = useState<PatientWorkspaceView>('profile')

  useEffect(() => {
    setWorkspaceView('profile')
  }, [workflow.selectedPatientId])

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

          {workflow.selectedPatient && (
            <>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="m-0 min-w-0 truncate text-xl font-bold tracking-[-0.02em] text-text-strong">
                  {workflow.selectedPatient.display_name}
                </h2>
                <PatientProfileActions workflow={workflow} />
              </div>

              <PatientViewMenu
                className="mt-3"
                value={workspaceView}
                onChange={setWorkspaceView}
                disabled={workflow.pendingAction}
              />

              <div className="w-full">
                {workspaceView === 'profile' && (
                  <PatientCard patient={workflow.selectedPatient} />
                )}

                {workspaceView === 'sessions' && (
                  <SessionsAnalyticsPanel
                    sessions={workflow.sessions}
                    activeSessionId={workflow.activeSession?.id ?? null}
                    patientId={workflow.selectedPatientId}
                    onSessionUpdated={() => void workflow.refreshSessions()}
                  />
                )}

                {workspaceView === 'assessments' && (
                  <AssessmentSection workflow={workflow} embedded />
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
