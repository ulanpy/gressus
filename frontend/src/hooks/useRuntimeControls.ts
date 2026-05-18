import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GameLaunchParams, RuntimePayload } from '../types/runtime'


type RuntimeErrorDetail = {
  message?: string
  logPath?: string | null
  logTail?: string | null
}

function extractErrorDetail(text: string): { message: string; logTail: string | null } {
  if (!text) return { message: 'runtime action failed', logTail: null }
  try {
    const parsed = JSON.parse(text) as { detail?: RuntimeErrorDetail | string }
    const detail = parsed.detail
    if (typeof detail === 'string') return { message: detail, logTail: null }
    if (detail && typeof detail === 'object') {
      const tail = detail.logTail ?? null
      const message = detail.message ?? 'runtime action failed'
      return { message, logTail: tail }
    }
  } catch {
    /* fall through to raw text */
  }
  return { message: text, logTail: null }
}

export function useRuntimeControls() {
  const [state, setState] = useState<RuntimePayload>({
    state: 'idle',
    activeJob: null,
    lastExit: null,
  })
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLogTail, setActionLogTail] = useState<string | null>(null)

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
      setActionLogTail(null)
      try {
        const response = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!response.ok) {
          const text = await response.text()
          const { message, logTail } = extractErrorDetail(text)
          if (logTail) setActionLogTail(logTail)
          throw new Error(message)
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
    (params: GameLaunchParams) => runAction('/api/runtime/start', { job: 'game', ...params }),
    [runAction],
  )
  const startCalibration = useCallback(
    () => runAction('/api/runtime/start', { job: 'calibrate_apriltag' }),
    [runAction],
  )
  const stopRuntime = useCallback(() => runAction('/api/runtime/stop', {}), [runAction])

  return useMemo(
    () => ({
      state,
      pending,
      actionError,
      actionLogTail,
      startGame,
      startCalibration,
      stopRuntime,
    }),
    [state, pending, actionError, actionLogTail, startGame, startCalibration, stopRuntime],
  )
}
