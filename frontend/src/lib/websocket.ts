import type { InsoleSize } from '../types/insole'
import { CONTACT_THRESHOLD_KPA } from '../constants/insole'


export function websocketUrl(size: InsoleSize, hz = 10) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const params = new URLSearchParams({ size, threshold_kpa: String(CONTACT_THRESHOLD_KPA), hz: String(hz) })

  return `${protocol}//${window.location.host}/ws/insole?${params}`
}

export function emgPreviewWebSocketUrl(hz = 10, points = 32) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const params = new URLSearchParams({ hz: String(hz), points: String(points) })
  return `${protocol}//${window.location.host}/ws/emg?${params}`
}

export function exoskeletonWebSocketUrl(hz = 20) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const params = new URLSearchParams({ hz: String(hz) })

  return `${protocol}//${window.location.host}/ws/exoskeleton?${params}`
}
