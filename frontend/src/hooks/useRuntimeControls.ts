import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ClinicalRuntimeContext, GameLaunchParams, RuntimePayload } from '../types/runtime'

function extractErrorMessage(text: string): string {
  if (!text) return 'runtime action failed'
  try {
    const parsed = JSON.parse(text) as { detail?: { message?: string } | string }
    const detail = parsed.detail
    if (typeof detail === 'string') return detail
    if (detail && typeof detail === 'object' && detail.message) return detail.message
  } catch {
    /* fall through to raw text */
  }
  return text
}

export function useRuntimeControls() {
  const [state, setState] = useState<RuntimePayload>({
    state: 'idle',
    activeJob: null,
    lastExit: null,
  })
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const refreshStatus = useCallback(async () => {
    const response = await fetch('/api/runtime/status')
    if (!response.ok) {
      throw new Error(`runtime status: ${response.status}`)
    }
    const payload = (await response.json()) as RuntimePayload
    setState(payload)
  }, [])

  const runAction = useCallback(
    async (path: string, body: object) => {
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
          throw new Error(extractErrorMessage(text))
        }
        await refreshStatus()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Не удалось выполнить действие')
      } finally {
        setPending(false)
      }
    },
    [refreshStatus],
  )

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
  }, [refreshStatus])

  const startGame = useCallback(
    (params: GameLaunchParams, clinical?: ClinicalRuntimeContext) =>
      runAction('/api/runtime/start', { job: 'game', ...params, ...clinical }),
    [runAction],
  )
  const startCalibration = useCallback(
    (params: Pick<GameLaunchParams, 'outputRotation'>, clinical?: ClinicalRuntimeContext) =>
      runAction('/api/runtime/start', {
        job: 'calibrate_apriltag',
        outputRotation: params.outputRotation,
        ...clinical,
      }),
    [runAction],
  )
  const stopRuntime = useCallback(() => runAction('/api/runtime/stop', {}), [runAction])

  return useMemo(
    () => ({
      state,
      pending,
      actionError,
      startGame,
      startCalibration,
      stopRuntime,
    }),
    [state, pending, actionError, startGame, startCalibration, stopRuntime],
  )
}
