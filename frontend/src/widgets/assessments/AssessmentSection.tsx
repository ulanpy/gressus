import { useState } from 'react'
import { ClipboardPlus, Plus } from 'lucide-react'
import { useI18n } from '@/i18n/context'
import type { PatientSessionWorkflow } from '@/hooks/usePatientSessionWorkflow'
import type { Assessment } from '@/types/assessments'
import { formatDateTime } from '@/lib/format'
import { Button } from '@/shared/ui/button'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/ui/empty'
import { AssessmentModal } from './AssessmentModal'

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

  const openCreate = () => {
    setModalMode('create')
    setSelectedAssessment(null)
    setModalOpen(true)
  }

  const content = (
    <>
      <div className="mb-3 flex items-center justify-end">
        <Button
          type="button"
          size="sm"
          className="h-9 gap-1.5"
          onClick={openCreate}
          disabled={workflow.pendingAction}
        >
          <Plus className="size-4" strokeWidth={2.5} />
          {t.assessment.add}
        </Button>
      </div>
      {workflow.assessments.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia className="bg-slate-600 text-white">
              <ClipboardPlus className="size-5 text-white" strokeWidth={2.25} />
            </EmptyMedia>
            <EmptyTitle>{t.assessment.empty}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="m-0 grid list-none gap-0 divide-y divide-border p-0">
          {workflow.assessments.map((assessment) => (
            <li
              key={assessment.id}
              className="flex min-h-[52px] flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
            >
              <div className="min-w-0">
                <p className="m-0 text-[15px] font-medium text-foreground">
                  {t.assessment.number(assessment.assessment_number ?? 0)}
                  {assessment.assessment_type ? (
                    <span className="ml-2 text-[13px] font-normal text-muted-foreground">
                      {assessment.assessment_type}
                    </span>
                  ) : null}
                </p>
                <p className="m-0 mt-1 text-[13px] text-muted-foreground">
                  {assessment.assessment_date && <span>{assessment.assessment_date} · </span>}
                  <span>{formatDateTime(assessment.created_at, language)}</span>
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-[13px] font-medium"
                onClick={() => openEdit(assessment)}
                disabled={workflow.pendingAction}
              >
                {t.assessment.open}
              </Button>
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
    return <div className="w-full">{content}</div>
  }

  return (
    <section className="rounded-xl border border-border bg-card px-6 py-5 shadow-sm">
      {content}
    </section>
  )
}
