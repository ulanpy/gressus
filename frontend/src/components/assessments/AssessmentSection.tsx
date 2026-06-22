import { useState } from 'react'
import { useI18n } from '../../i18n/context'
import type { PatientSessionWorkflow } from '../../hooks/usePatientSessionWorkflow'
import type { Assessment } from '../../types/assessments'
import { formatDateTime } from '../../lib/format'
import { cn } from '../../lib/cn'
import { AssessmentModal } from './AssessmentModal'
import {
  sessionHistory,
  sessionHistoryItem,
  workflowMuted,
  workflowStepActions,
} from '../../styles/ui'

type AssessmentSectionProps = {
  workflow: PatientSessionWorkflow
  embedded?: boolean
}

export function AssessmentSection({ workflow, embedded = false }: AssessmentSectionProps) {
  const { t, language } = useI18n()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null)

  if (!workflow.selectedPatient) return null

  const openEdit = (assessment: Assessment) => {
    setModalMode('edit')
    setSelectedAssessment(assessment)
    setModalOpen(true)
  }

  const content = (
    <>
      {workflow.assessments.length === 0 ? (
        <p className={workflowMuted}>{t.assessment.empty}</p>
      ) : (
        <ul className={cn(sessionHistory, embedded ? 'mt-3' : 'mt-3')}>
          {workflow.assessments.map((assessment) => (
            <li key={assessment.id} className={sessionHistoryItem}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <strong>{t.assessment.number(assessment.assessment_number ?? 0)}</strong>
                  {assessment.assessment_type && (
                    <span className="ml-2 text-xs text-muted">{assessment.assessment_type}</span>
                  )}
                </div>
                <div className={workflowStepActions}>
                  <button
                    type="button"
                    className="rounded-full border border-panel-border bg-white px-3 py-1 text-xs font-semibold"
                    onClick={() => openEdit(assessment)}
                    disabled={workflow.pendingAction}
                  >
                    {t.assessment.open}
                  </button>
                </div>
              </div>
              <div className="mt-1 text-xs text-muted">
                {assessment.assessment_date && <span>{assessment.assessment_date} · </span>}
                <span>{formatDateTime(assessment.created_at, language)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AssessmentModal
        open={modalOpen}
        mode={modalMode}
        assessment={selectedAssessment}
        pending={workflow.pendingAction}
        workflow={workflow}
        onClose={() => setModalOpen(false)}
        onSaved={() => void workflow.refreshAssessments()}
      />
    </>
  )

  if (embedded) {
    return <div className="mt-4 w-full">{content}</div>
  }

  return (
    <section className={cn('rounded-2xl border border-panel-border bg-panel px-4 py-3 shadow-panel')}>
      {content}
    </section>
  )
}
