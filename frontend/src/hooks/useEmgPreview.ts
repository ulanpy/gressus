import { useEffect, useState } from 'react'
import { emgPreviewWebSocketUrl } from '@/lib/websocket'

export type EmgPreviewChannel = {
  slot: number
  samples: number[]
}

export type EmgPreviewFrame = {
  connected: boolean
  error?: string | null
  frameSeq: number | null
  sampleRateHz?: number
  samplesPerChannel?: number
  channels: EmgPreviewChannel[]
}

/** Low-rate EMG display feed. It is mounted only while the preview is open. */
export function useEmgPreview() {
  const [frame, setFrame] = useState<EmgPreviewFrame | null>(null)
  const [status, setStatus] = useState('ожидание')

  useEffect(() => {
    const ws = new WebSocket(emgPreviewWebSocketUrl(10, 32))
    ws.onopen = () => setStatus('подключено')
    ws.onmessage = (event) => {
      const next = JSON.parse(event.data) as EmgPreviewFrame
      setFrame(next)
      setStatus(next.connected ? 'подключено' : 'нет данных')
    }
    ws.onerror = () => setStatus('ошибка сокета')
    ws.onclose = () => setStatus('отключено')
    return () => {
      ws.close()
    }
  }, [])

  return { frame, status }
}
