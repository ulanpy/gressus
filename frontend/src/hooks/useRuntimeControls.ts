import { useEffect, useState } from 'react'
import type { GameLaunchParams, RuntimePayload } from '../types/runtime'


export function useRuntimeControls() {
  const [state, setState] = useState<RuntimePayload>({
    state: 'idle',
    activeJob: null,
    lastExit: null,
  })
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const refreshStatus = async () => {
    const response = await fetch('/api/runtime/status')
    if (!response.ok) {
      throw new Error(`runtime status: ${response.status}`)
    }
    const payload = (await response.json()) as RuntimePayload
    setState(payload)
  }

  const runAction = async (path: string, body: object) => {
    setPending(true)
    setActionError(null)
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `runtime action failed: ${response.status}`)
      }
      await refreshStatus()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось выполнить действие')
    } finally {
      setPending(false)
    }
  }

  useEffect(() => {
    let stopped = false
    const tick = async () => {
      try {
        await refreshStatus()
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
  }, [])

  return {
    state,
    pending,
    actionError,
    startGame: (params: GameLaunchParams) =>
      runAction('/api/runtime/start', {
        job: 'game',
        ...params,
      }),
    startCalibration: () =>
      runAction('/api/runtime/start', {
        job: 'calibrate_apriltag',
      }),
    stopRuntime: () => runAction('/api/runtime/stop', {}),
  }
}
