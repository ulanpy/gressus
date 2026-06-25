import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RuntimePayload } from '../types/runtime'

export function useRuntimeControls() {
  const [state, setState] = useState<RuntimePayload>({
    state: 'idle',
    activeJob: null,
    lastExit: null,
  })
  const [actionError, setActionError] = useState<string | null>(null)

  const refreshStatus = useCallback(async () => {
    const response = await fetch('/api/runtime/status')
    if (!response.ok) {
      throw new Error(`runtime status: ${response.status}`)
    }
    const payload = (await response.json()) as RuntimePayload
    setState(payload)
  }, [])

  useEffect(() => {
    let stopped = false
    const tick = async () => {
      try {
        await refreshStatus()
        if (!stopped) setActionError(null)
      } catch {
        if (!stopped) {
          setActionError('Backend runtime недоступен')
        }
      }
    }
    void tick()
    const timer = window.setInterval(() => void tick(), 1500)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [refreshStatus])

  return useMemo(() => ({ state, actionError }), [state, actionError])
}
