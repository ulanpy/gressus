import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n/context'
import type { Assessment, AssessmentCreate, AssessmentUpdate, BodyData, ObservationsData, SpatialGaitData, WalkingTestsData } from '../../types/assessments'
import type { PatientSessionWorkflow } from '../../hooks/usePatientSessionWorkflow'
import { numberToInput, parseOptionalNumber } from '../../lib/form'
import {
  workflowBtnPrimary,
  workflowBtnSecondary,
  workflowField,
  workflowFieldInput,
  workflowDateInput,
  workflowFieldLabel,
  workflowModal,
  workflowModalActions,
  workflowModalBackdrop,
  workflowModalPanel,
} from '../../styles/ui'
import { cn } from '../../lib/cn'

type TabId = 'header' | 'body' | 'spatial' | 'walking' | 'observations'

type AssessmentModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  assessment: Assessment | null
  pending: boolean
  workflow: PatientSessionWorkflow
  onClose: () => void
  onSaved: () => void
}

const TABS: TabId[] = ['header', 'body', 'spatial', 'walking', 'observations']

const emptyObservations = (): ObservationsData => ({
  toe_walking: false,
  foot_dragging: false,
  hip_hiking: false,
  circumduction: false,
  crouched_gait: false,
  scissor_gait: false,
  reduced_arm_swing: false,
  uses_aid: false,
  needs_support: false,
  notes: null,
})

export function AssessmentModal({
  open,
  mode,
  assessment,
  pending,
  workflow,
  onClose,
  onSaved,
}: AssessmentModalProps) {
  const { t } = useI18n()
  const [tab, setTab] = useState<TabId>('header')
  const [assessmentDate, setAssessmentDate] = useState('')
  const [assessmentType, setAssessmentType] = useState('')
  const [bodyWeight, setBodyWeight] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [legLeft, setLegLeft] = useState('')
  const [legRight, setLegRight] = useState('')
  const [stepLengthLeft, setStepLengthLeft] = useState('')
  const [stepLengthRight, setStepLengthRight] = useState('')
  const [strideLeft, setStrideLeft] = useState('')
  const [strideRight, setStrideRight] = useState('')
  const [stepWidth, setStepWidth] = useState('')
  const [stepSymmetry, setStepSymmetry] = useState('')
  const [footAngleLeft, setFootAngleLeft] = useState('')
  const [footAngleRight, setFootAngleRight] = useState('')
  const [cadence, setCadence] = useState('')
  const [speedComfort, setSpeedComfort] = useState('')
  const [speedFast, setSpeedFast] = useState('')
  const [tug, setTug] = useState('')
  const [distance6mwt, setDistance6mwt] = useState('')
  const [observations, setObservations] = useState<ObservationsData>(emptyObservations())

  useEffect(() => {
    if (!open) return
    setTab('header')
    setAssessmentDate(assessment?.assessment_date ?? '')
    setAssessmentType(assessment?.assessment_type ?? '')
    setBodyWeight(numberToInput(assessment?.body?.body_weight_kg))
    setHeightCm(numberToInput(assessment?.body?.height_cm))
    setLegLeft(numberToInput(assessment?.body?.leg_length_left_m))
    setLegRight(numberToInput(assessment?.body?.leg_length_right_m))
    setStepLengthLeft(numberToInput(assessment?.spatial_gait?.step_length_left_cm))
    setStepLengthRight(numberToInput(assessment?.spatial_gait?.step_length_right_cm))
    setStrideLeft(numberToInput(assessment?.spatial_gait?.stride_length_left_cm))
    setStrideRight(numberToInput(assessment?.spatial_gait?.stride_length_right_cm))
    setStepWidth(numberToInput(assessment?.spatial_gait?.step_width_cm))
    setStepSymmetry(numberToInput(assessment?.spatial_gait?.step_symmetry_index_pct))
    setFootAngleLeft(numberToInput(assessment?.spatial_gait?.foot_angle_left))
    setFootAngleRight(numberToInput(assessment?.spatial_gait?.foot_angle_right))
    setCadence(numberToInput(assessment?.walking_tests?.cadence_steps_min))
    setSpeedComfort(numberToInput(assessment?.walking_tests?.speed_10mwt_comfort_ms))
    setSpeedFast(numberToInput(assessment?.walking_tests?.speed_10mwt_fast_ms))
    setTug(numberToInput(assessment?.walking_tests?.tug_seconds))
    setDistance6mwt(numberToInput(assessment?.walking_tests?.distance_6mwt_m))
    setObservations({ ...emptyObservations(), ...assessment?.observations })
  }, [open, assessment])

  if (!open) return null

  const tabLabel = (id: TabId) => {
    switch (id) {
      case 'header':
        return t.assessment.tabHeader
      case 'body':
        return t.assessment.tabBody
      case 'spatial':
        return t.assessment.tabSpatial
      case 'walking':
        return t.assessment.tabWalking
      default:
        return t.assessment.tabObservations
    }
  }

  const bodyPayload = (): BodyData => ({
    body_weight_kg: parseOptionalNumber(bodyWeight),
    height_cm: parseOptionalNumber(heightCm),
    leg_length_left_m: parseOptionalNumber(legLeft),
    leg_length_right_m: parseOptionalNumber(legRight),
  })

  const spatialPayload = (): SpatialGaitData => ({
    step_length_left_cm: parseOptionalNumber(stepLengthLeft),
    step_length_right_cm: parseOptionalNumber(stepLengthRight),
    stride_length_left_cm: parseOptionalNumber(strideLeft),
    stride_length_right_cm: parseOptionalNumber(strideRight),
    step_width_cm: parseOptionalNumber(stepWidth),
    step_symmetry_index_pct: parseOptionalNumber(stepSymmetry),
    foot_angle_left: parseOptionalNumber(footAngleLeft),
    foot_angle_right: parseOptionalNumber(footAngleRight),
  })

  const walkingPayload = (): WalkingTestsData => ({
    cadence_steps_min: parseOptionalNumber(cadence),
    speed_10mwt_comfort_ms: parseOptionalNumber(speedComfort),
    speed_10mwt_fast_ms: parseOptionalNumber(speedFast),
    tug_seconds: parseOptionalNumber(tug),
    distance_6mwt_m: parseOptionalNumber(distance6mwt),
  })

  const headerPayload = (): AssessmentUpdate => ({
    assessment_date: assessmentDate || null,
    assessment_type: assessmentType.trim() || null,
  })

  const createPayload = (): AssessmentCreate => ({
    ...headerPayload(),
    body: bodyPayload(),
    spatial_gait: spatialPayload(),
    walking_tests: walkingPayload(),
    observations,
  })

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (mode === 'create') {
      await workflow.createAssessment(createPayload())
    } else if (assessment) {
      await workflow.updateAssessment(assessment.id, headerPayload())
      await workflow.saveAssessmentBody(assessment.id, bodyPayload())
      await workflow.saveAssessmentSpatialGait(assessment.id, spatialPayload())
      await workflow.saveAssessmentWalkingTests(assessment.id, walkingPayload())
      await workflow.saveAssessmentObservations(assessment.id, observations)
    }
    onSaved()
    onClose()
  }

  const toggleObservation = (key: keyof ObservationsData) => {
    if (key === 'notes') return
    setObservations((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const numberField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
  ) => (
    <label className={workflowField} key={label}>
      <span className={workflowFieldLabel}>{label}</span>
      <input
        type="number"
        step="any"
        className={workflowFieldInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )

  return createPortal(
    <div className={workflowModal} role="dialog" aria-modal="true">
      <div className={workflowModalBackdrop} onClick={onClose} />
      <form
        className={cn(workflowModalPanel, 'max-h-[90vh] max-w-[640px] overflow-y-auto')}
        onSubmit={(e) => void handleSubmit(e)}
      >
        <header>
          <h2 className="m-0">
            {mode === 'create' ? t.assessment.create : t.assessment.edit}
          </h2>
        </header>

        <div className="flex flex-wrap gap-1.5">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold',
                tab === id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-panel-border bg-white text-text-strong',
              )}
              onClick={() => setTab(id)}
            >
              {tabLabel(id)}
            </button>
          ))}
        </div>

        {tab === 'header' && (
          <>
            <label className={workflowField}>
              <span className={workflowFieldLabel}>{t.assessment.assessmentDate}</span>
              <input
                type="date"
                className={workflowDateInput}
                value={assessmentDate}
                onChange={(e) => setAssessmentDate(e.target.value)}
              />
            </label>
            <label className={workflowField}>
              <span className={workflowFieldLabel}>{t.assessment.assessmentType}</span>
              <input
                type="text"
                className={workflowFieldInput}
                value={assessmentType}
                onChange={(e) => setAssessmentType(e.target.value)}
              />
            </label>
          </>
        )}

        {tab === 'body' && (
          <>
            {numberField(t.assessment.bodyWeightKg, bodyWeight, setBodyWeight)}
            {numberField(t.assessment.heightCm, heightCm, setHeightCm)}
            {numberField(t.assessment.legLengthLeftM, legLeft, setLegLeft)}
            {numberField(t.assessment.legLengthRightM, legRight, setLegRight)}
          </>
        )}

        {tab === 'spatial' && (
          <>
            {numberField(t.assessment.stepLengthLeftCm, stepLengthLeft, setStepLengthLeft)}
            {numberField(t.assessment.stepLengthRightCm, stepLengthRight, setStepLengthRight)}
            {numberField(t.assessment.strideLengthLeftCm, strideLeft, setStrideLeft)}
            {numberField(t.assessment.strideLengthRightCm, strideRight, setStrideRight)}
            {numberField(t.assessment.stepWidthCm, stepWidth, setStepWidth)}
            {numberField(t.assessment.stepSymmetryIndexPct, stepSymmetry, setStepSymmetry)}
            {numberField(t.assessment.footAngleLeft, footAngleLeft, setFootAngleLeft)}
            {numberField(t.assessment.footAngleRight, footAngleRight, setFootAngleRight)}
          </>
        )}

        {tab === 'walking' && (
          <>
            {numberField(t.assessment.cadenceStepsMin, cadence, setCadence)}
            {numberField(t.assessment.speed10mwtComfortMs, speedComfort, setSpeedComfort)}
            {numberField(t.assessment.speed10mwtFastMs, speedFast, setSpeedFast)}
            {numberField(t.assessment.tugSeconds, tug, setTug)}
            {numberField(t.assessment.distance6mwtM, distance6mwt, setDistance6mwt)}
          </>
        )}

        {tab === 'observations' && (
          <>
            {(
              [
                ['toe_walking', t.assessment.toeWalking],
                ['foot_dragging', t.assessment.footDragging],
                ['hip_hiking', t.assessment.hipHiking],
                ['circumduction', t.assessment.circumduction],
                ['crouched_gait', t.assessment.crouchedGait],
                ['scissor_gait', t.assessment.scissorGait],
                ['reduced_arm_swing', t.assessment.reducedArmSwing],
                ['uses_aid', t.assessment.usesAid],
                ['needs_support', t.assessment.needsSupport],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="mt-1 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(observations[key])}
                  onChange={() => toggleObservation(key)}
                />
                <span>{label}</span>
              </label>
            ))}
            <label className={workflowField}>
              <span className={workflowFieldLabel}>{t.assessment.notes}</span>
              <textarea
                className={workflowFieldInput}
                rows={3}
                value={observations.notes ?? ''}
                onChange={(e) =>
                  setObservations((prev) => ({ ...prev, notes: e.target.value || null }))
                }
              />
            </label>
          </>
        )}

        <footer className={workflowModalActions}>
          <button type="button" className={workflowBtnSecondary} onClick={onClose}>
            {t.workflow.cancel}
          </button>
          <button type="submit" className={workflowBtnPrimary} disabled={pending}>
            {t.workflow.save}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  )
}
