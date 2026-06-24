import { useEffect, useState } from 'react'
import type { ExoskeletonTelemetryFrame } from '../types/exoskeleton'
import { exoskeletonWebSocketUrl } from '../lib/websocket'

export function useExoskeletonTelemetry(enabled = true) {
  const [frame, setFrame] = useState<ExoskeletonTelemetryFrame | null>(null)
  const [status, setStatus] = useState('ожидание')

  useEffect(() => {
    if (!enabled) {
      setFrame(null)
      setStatus('ожидание')
      return
    }

    const ws = new WebSocket(exoskeletonWebSocketUrl())

    ws.onopen = () => setStatus('подключено')
    ws.onmessage = (event) => {
      setFrame(JSON.parse(event.data) as ExoskeletonTelemetryFrame)
      setStatus('подключено')
    }
    ws.onerror = () => setStatus('ошибка сокета')
    ws.onclose = () => setStatus('отключено')

    return () => ws.close()
  }, [enabled])

  return { frame, status }
}
