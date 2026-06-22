import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n/context'
import type { SessionCreateBody } from '../../types/sessions'
import { parseOptionalNumber } from '../../lib/form'
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

type SessionStartModalProps = {
  open: boolean
  pending: boolean
  onClose: () => void
  onStart: (data: SessionCreateBody) => Promise<void>
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function SessionStartModal({ open, pending, onClose, onStart }: SessionStartModalProps) {
  const { t } = useI18n()
  const [sessionDate, setSessionDate] = useState(todayIsoDate())
  const [sessionType, setSessionType] = useState('')
  const [passiveCalibrationDone, setPassiveCalibrationDone] = useState(false)
  const [baselineRight, setBaselineRight] = useState('')
  const [baselineLeft, setBaselineLeft] = useState('')
  const [samplingRate, setSamplingRate] = useState('')

  useEffect(() => {
    if (open) {
      setSessionDate(todayIsoDate())
      setSessionType('')
      setPassiveCalibrationDone(false)
      setBaselineRight('')
      setBaselineLeft('')
      setSamplingRate('')
    }
  }, [open])

  if (!open) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    await onStart({
      session_date: sessionDate || null,
      session_type: sessionType.trim() || null,
      passive_calibration_done: passiveCalibrationDone,
      baseline_force_right: parseOptionalNumber(baselineRight),
      baseline_force_left: parseOptionalNumber(baselineLeft),
      sampling_rate_hz: parseOptionalNumber(samplingRate),
    })
    onClose()
  }

  return createPortal(
    <div className={workflowModal} role="dialog" aria-modal="true">
      <div className={workflowModalBackdrop} onClick={onClose} />
      <form
        className={cn(workflowModalPanel, 'max-h-[85vh] max-w-[520px] overflow-y-auto')}
        onSubmit={(e) => void handleSubmit(e)}
      >
        <header>
          <h2 className="m-0">{t.workflow.startSession}</h2>
        </header>

        <label className={workflowField}>
          <span className={workflowFieldLabel}>{t.workflow.sessionDate}</span>
          <input
            type="date"
            className={workflowDateInput}
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            autoFocus
          />
        </label>

        <label className={workflowField}>
          <span className={workflowFieldLabel}>{t.workflow.sessionType}</span>
          <input
            type="text"
            className={workflowFieldInput}
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value)}
            placeholder={t.workflow.sessionTypePlaceholder}
          />
        </label>

        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={passiveCalibrationDone}
            onChange={(e) => setPassiveCalibrationDone(e.target.checked)}
          />
          <span>{t.workflow.passiveCalibrationDone}</span>
        </label>

        <label className={workflowField}>
          <span className={workflowFieldLabel}>{t.workflow.baselineForceRight}</span>
          <input
            type="number"
            step="any"
            className={workflowFieldInput}
            value={baselineRight}
            onChange={(e) => setBaselineRight(e.target.value)}
          />
        </label>

        <label className={workflowField}>
          <span className={workflowFieldLabel}>{t.workflow.baselineForceLeft}</span>
          <input
            type="number"
            step="any"
            className={workflowFieldInput}
            value={baselineLeft}
            onChange={(e) => setBaselineLeft(e.target.value)}
          />
        </label>

        <label className={workflowField}>
          <span className={workflowFieldLabel}>{t.workflow.samplingRateHz}</span>
          <input
            type="number"
            step="any"
            className={workflowFieldInput}
            value={samplingRate}
            onChange={(e) => setSamplingRate(e.target.value)}
          />
        </label>

        <footer className={workflowModalActions}>
          <button type="button" className={workflowBtnSecondary} onClick={onClose}>
            {t.workflow.cancel}
          </button>
          <button type="submit" className={workflowBtnPrimary} disabled={pending}>
            {t.workflow.startSession}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  )
}
