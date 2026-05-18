import type { SourceMode, InsoleSize } from '../types/insole'
import { CONTACT_THRESHOLD_KPA } from '../constants/insole'


export function websocketUrl(source: SourceMode, size: InsoleSize) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const params = new URLSearchParams({ source, size, threshold_kpa: String(CONTACT_THRESHOLD_KPA), hz: '50' })

  return `${protocol}//${window.location.host}/ws/insole?${params}`
}
