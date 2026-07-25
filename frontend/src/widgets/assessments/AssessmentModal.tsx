import { useEffect, useState, type FormEvent } from 'react'
import { useI18n } from '@/i18n/context'
import type {
  Assessment,
  AssessmentCreate,
  AssessmentUpdate,
  BodyData,
  ObservationsData,
  SpatialGaitData,
  WalkingTestsData,
} from '@/types/assessments'
import type { PatientSessionWorkflow } from '@/hooks/usePatientSessionWorkflow'
import { numberToInput, parseOptionalNumber } from '@/lib/form'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { DatePicker } from '@/shared/ui/date-picker'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Textarea } from '@/shared/ui/textarea'

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

  const numberField = (label: string, value: string, onChange: (v: string) => void) => (
    <div className="grid gap-2" key={label}>
      <Label>{label}</Label>
      <Input type="number" step="any" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next && !pending) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-[640px] overflow-y-auto">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? t.assessment.create : t.assessment.edit}</DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(value: string) => setTab(value as TabId)} className="mt-4">
            <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
              {(['header', 'body', 'spatial', 'walking', 'observations'] as TabId[]).map((id) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="rounded-full border border-panel-border px-3 py-1.5 text-xs font-semibold data-[state=active]:border-slate-900 data-[state=active]:bg-slate-900 data-[state=active]:text-white"
                >
                  {tabLabel(id)}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="header" className="grid gap-4">
              <div className="grid gap-2">
                <Label>{t.assessment.assessmentDate}</Label>
                <DatePicker value={assessmentDate} onChange={setAssessmentDate} />
              </div>
              <div className="grid gap-2">
                <Label>{t.assessment.assessmentType}</Label>
                <Input type="text" value={assessmentType} onChange={(e) => setAssessmentType(e.target.value)} />
              </div>
            </TabsContent>

            <TabsContent value="body" className="grid gap-4">
              {numberField(t.assessment.bodyWeightKg, bodyWeight, setBodyWeight)}
              {numberField(t.assessment.heightCm, heightCm, setHeightCm)}
              {numberField(t.assessment.legLengthLeftM, legLeft, setLegLeft)}
              {numberField(t.assessment.legLengthRightM, legRight, setLegRight)}
            </TabsContent>

            <TabsContent value="spatial" className="grid gap-4">
              {numberField(t.assessment.stepLengthLeftCm, stepLengthLeft, setStepLengthLeft)}
              {numberField(t.assessment.stepLengthRightCm, stepLengthRight, setStepLengthRight)}
              {numberField(t.assessment.strideLengthLeftCm, strideLeft, setStrideLeft)}
              {numberField(t.assessment.strideLengthRightCm, strideRight, setStrideRight)}
              {numberField(t.assessment.stepWidthCm, stepWidth, setStepWidth)}
              {numberField(t.assessment.stepSymmetryIndexPct, stepSymmetry, setStepSymmetry)}
              {numberField(t.assessment.footAngleLeft, footAngleLeft, setFootAngleLeft)}
              {numberField(t.assessment.footAngleRight, footAngleRight, setFootAngleRight)}
            </TabsContent>

            <TabsContent value="walking" className="grid gap-4">
              {numberField(t.assessment.cadenceStepsMin, cadence, setCadence)}
              {numberField(t.assessment.speed10mwtComfortMs, speedComfort, setSpeedComfort)}
              {numberField(t.assessment.speed10mwtFastMs, speedFast, setSpeedFast)}
              {numberField(t.assessment.tugSeconds, tug, setTug)}
              {numberField(t.assessment.distance6mwtM, distance6mwt, setDistance6mwt)}
            </TabsContent>

            <TabsContent value="observations" className="grid gap-4">
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
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`obs-${key}`}
                    checked={Boolean(observations[key])}
                    onCheckedChange={() => toggleObservation(key)}
                  />
                  <Label htmlFor={`obs-${key}`} className="text-sm font-normal">
                    {label}
                  </Label>
                </div>
              ))}
              <div className="grid gap-2">
                <Label>{t.assessment.notes}</Label>
                <Textarea
                  rows={3}
                  value={observations.notes ?? ''}
                  onChange={(e) =>
                    setObservations((prev) => ({ ...prev, notes: e.target.value || null }))
                  }
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {t.workflow.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {t.workflow.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
