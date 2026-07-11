import type { Translation } from '../../i18n/translations'
import type { PgearStatusSnapshot } from '../api/runtime'

export type ExoLinkTone = 'connected' | 'waiting' | 'unavailable' | 'lost'

export type ExoLinkStatus = {
  label: string
  tone: ExoLinkTone
  detail: string | null
}

function normalizeError(error: string): string {
  return error.trim().toLowerCase()
}

function isWaitingForDevice(error: string | null | undefined): boolean {
  if (!error) return false
  const text = normalizeError(error)
  return (
    text.includes('waiting') ||
    text.includes('no telemetry yet') ||
    text.includes('logpacket') ||
    text.includes('udp')
  )
}

function isStaleLink(error: string | null | undefined): boolean {
  if (!error) return false
  return normalizeError(error).includes('stale')
}

function isGressusDown(error: string | null | undefined): boolean {
  if (!error) return false
  const text = normalizeError(error)
  return text.includes('telemetry publisher not running') || text.includes('session manager')
}

/** Map runtime / ROS probe errors to therapist-facing copy. */
export function resolveExoLinkStatus(
  pgear: PgearStatusSnapshot | null,
  statusError: string | null,
  t: Translation,
): ExoLinkStatus {
  const exo = t.exoskeleton

  if (statusError) {
    return {
      label: exo.linkGressusDown,
      tone: 'unavailable',
      detail: exo.linkGressusDown,
    }
  }

  if (!pgear) {
    return {
      label: exo.statusLoading,
      tone: 'waiting',
      detail: null,
    }
  }

  if (pgear.connected) {
    return {
      label: exo.linkConnected,
      tone: 'connected',
      detail: mapExoErrorDetail(pgear.error, t),
    }
  }

  if (!pgear.nodeAvailable) {
    return {
      label: exo.linkGressusDown,
      tone: 'unavailable',
      detail: exo.linkGressusDown,
    }
  }

  if (isStaleLink(pgear.error)) {
    return {
      label: exo.linkLost,
      tone: 'lost',
      detail: exo.linkLostDetail,
    }
  }

  if (isWaitingForDevice(pgear.error) || !pgear.error) {
    return {
      label: exo.linkWaiting,
      tone: 'waiting',
      detail: exo.linkWaitingDetail,
    }
  }

  return {
    label: exo.linkWaiting,
    tone: 'waiting',
    detail: exo.linkWaitingDetail,
  }
}

export function mapExoErrorDetail(error: string | null | undefined, t: Translation): string | null {
  if (!error) return null
  const exo = t.exoskeleton

  if (isGressusDown(error)) return exo.linkGressusDown
  if (isWaitingForDevice(error)) return exo.linkWaitingDetail
  if (isStaleLink(error)) return exo.linkLostDetail

  return exo.deviceErrorGeneric
}
