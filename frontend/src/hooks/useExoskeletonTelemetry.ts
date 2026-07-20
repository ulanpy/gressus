import { useEffect, useRef, useState } from 'react'
import type { ExoskeletonTelemetryFrame } from '../types/exoskeleton'
import {
  appendTrimmed,
  sampleFromFrame,
  TELEMETRY_HISTORY_MAX_POINTS,
  TELEMETRY_UI_HZ,
  TELEMETRY_WINDOW_SECONDS,
  type TelemetryHistoryPoint,
} from '../lib/exoskeleton/telemetryHistory'
import { exoskeletonWebSocketUrl } from '../lib/websocket'

export type ExoskeletonControlFlags = {
  estop: boolean
  running: boolean
  error: string | null
}

const IDLE_FLAGS: ExoskeletonControlFlags = {
  estop: false,
  running: false,
  error: null,
}

function flagsFromFrame(frame: ExoskeletonTelemetryFrame): ExoskeletonControlFlags {
  return {
    estop: Boolean(frame.estop),
    running: Boolean(frame.running),
    error: frame.error ?? null,
  }
}

function flagsEqual(a: ExoskeletonControlFlags, b: ExoskeletonControlFlags): boolean {
  return a.estop === b.estop && a.running === b.running && a.error === b.error
}

/**
 * Live telemetry with a fixed 30s window.
 * High-frequency chart state is intended for a leaf component — do not lift it
 * into a large parent or the whole page will re-render at UI Hz.
 */
export function useExoskeletonTelemetry(enabled = true) {
  const [frame, setFrame] = useState<ExoskeletonTelemetryFrame | null>(null)
  const [history, setHistory] = useState<TelemetryHistoryPoint[]>([])
  const [status, setStatus] = useState('ожидание')
  const [flags, setFlags] = useState<ExoskeletonControlFlags>(IDLE_FLAGS)

  const bufferRef = useRef<TelemetryHistoryPoint[]>([])
  const latestFrameRef = useRef<ExoskeletonTelemetryFrame | null>(null)
  const statusRef = useRef(status)
  const flagsRef = useRef(flags)
  const visibleRef = useRef(
    typeof document === 'undefined' ? true : document.visibilityState === 'visible',
  )

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    flagsRef.current = flags
  }, [flags])

  useEffect(() => {
    if (!enabled) {
      bufferRef.current = []
      latestFrameRef.current = null
      setFrame(null)
      setHistory([])
      setStatus('ожидание')
      setFlags(IDLE_FLAGS)
      return
    }

    const ws = new WebSocket(exoskeletonWebSocketUrl())
    const publishMs = 1000 / TELEMETRY_UI_HZ

    const setStatusIfChanged = (next: string) => {
      if (statusRef.current === next) return
      statusRef.current = next
      setStatus(next)
    }

    const setFlagsIfChanged = (next: ExoskeletonControlFlags) => {
      if (flagsEqual(flagsRef.current, next)) return
      flagsRef.current = next
      setFlags(next)
    }

    ws.onopen = () => setStatusIfChanged('подключено')
    ws.onmessage = (event) => {
      const next = JSON.parse(event.data) as ExoskeletonTelemetryFrame
      latestFrameRef.current = next
      setStatusIfChanged('подключено')
      // Control flags are rare — publish immediately so workflow stays responsive.
      setFlagsIfChanged(flagsFromFrame(next))
    }
    ws.onerror = () => setStatusIfChanged('ошибка сокета')
    ws.onclose = () => setStatusIfChanged('отключено')

    const onVisibility = () => {
      visibleRef.current = document.visibilityState === 'visible'
    }
    document.addEventListener('visibilitychange', onVisibility)

    const timer = window.setInterval(() => {
      if (!visibleRef.current) return
      const latest = latestFrameRef.current
      if (!latest) return

      const at = Date.now()
      bufferRef.current = appendTrimmed(
        bufferRef.current,
        sampleFromFrame(latest, at),
        TELEMETRY_WINDOW_SECONDS,
        TELEMETRY_HISTORY_MAX_POINTS,
      )
      setFrame(latest)
      setHistory(bufferRef.current.slice())
    }, publishMs)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      ws.close()
      bufferRef.current = []
      latestFrameRef.current = null
    }
  }, [enabled])

  return {
    frame,
    history,
    status,
    flags,
    windowSeconds: TELEMETRY_WINDOW_SECONDS,
  }
}
