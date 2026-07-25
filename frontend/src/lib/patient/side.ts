type SideLabels = {
  sideLeft: string
  sideRight: string
}

export type NormalizedSide = 'left' | 'right'

export function normalizePatientSide(
  value: string | null | undefined,
  labels: SideLabels,
): NormalizedSide | null {
  if (!value?.trim()) return null

  const raw = value.trim()
  const lower = raw.toLowerCase()

  if (
    lower === 'left' ||
    lower === 'l' ||
    raw === labels.sideLeft ||
    lower.includes('лев') ||
    lower.includes('left')
  ) {
    return 'left'
  }

  if (
    lower === 'right' ||
    lower === 'r' ||
    raw === labels.sideRight ||
    lower.includes('прав') ||
    lower.includes('right')
  ) {
    return 'right'
  }

  return null
}

export function sideDisplayLabel(
  value: string | null | undefined,
  labels: SideLabels,
): string | null {
  if (!value?.trim()) return null
  const normalized = normalizePatientSide(value, labels)
  if (normalized === 'left') return labels.sideLeft
  if (normalized === 'right') return labels.sideRight
  return value.trim()
}
