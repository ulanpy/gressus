import { useI18n } from '../../i18n/context'
import type { SessionAnthropometrics } from '../../types/sessions'

type SessionAnthropometricsLineProps = {
  anthropometrics: SessionAnthropometrics | null | undefined
  className?: string
}

function formatLength(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null
  return `${value.toFixed(2)} m`
}

function formatWeight(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null
  return `${value.toFixed(1)} kg`
}

export function SessionAnthropometricsLine({
  anthropometrics,
  className,
}: SessionAnthropometricsLineProps) {
  const { t } = useI18n()
  if (!anthropometrics) return null

  const left = formatLength(anthropometrics.leg_length_left)
  const right = formatLength(anthropometrics.leg_length_right)
  const weight = formatWeight(anthropometrics.bodyweight)

  if (!left && !right && !weight) return null

  const parts: string[] = []
  if (left) parts.push(`${t.workflow.legLengthLeftShort}: ${left}`)
  if (right) parts.push(`${t.workflow.legLengthRightShort}: ${right}`)
  if (weight) parts.push(`${t.workflow.bodyweightShort}: ${weight}`)

  return (
    <span className={className}>
      {parts.join(' · ')}
    </span>
  )
}

export const DEFAULT_ANTHROPOMETRICS: SessionAnthropometrics = {
  leg_length_left: 0.62,
  leg_length_right: 0.62,
  bodyweight: null,
}

export function buildAnthropometricsPayload(
  values: SessionAnthropometrics,
): SessionAnthropometrics | undefined {
  const payload: SessionAnthropometrics = {}
  if (values.leg_length_left != null && Number.isFinite(values.leg_length_left)) {
    payload.leg_length_left = values.leg_length_left
  }
  if (values.leg_length_right != null && Number.isFinite(values.leg_length_right)) {
    payload.leg_length_right = values.leg_length_right
  }
  if (values.bodyweight != null && Number.isFinite(values.bodyweight)) {
    payload.bodyweight = values.bodyweight
  }
  return Object.keys(payload).length > 0 ? payload : undefined
}
