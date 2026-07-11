import { useEffect, useState } from 'react'
import { getRuntimeStatus, type RuntimeSnapshot } from '../lib/api/runtime'

const DEFAULT_POLL_MS = 2000

export type RuntimeStatusState = {
  snapshot: RuntimeSnapshot | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useRuntimeStatus(enabled = true, pollMs = DEFAULT_POLL_MS): RuntimeStatusState {
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setSnapshot(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    let timer: number | undefined

    const poll = async () => {
      try {
        const next = await getRuntimeStatus()
        if (cancelled) return
        setSnapshot(next)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'runtime status unavailable')
      } finally {
        if (!cancelled) {
          setLoading(false)
          timer = window.setTimeout(() => {
            void poll()
          }, pollMs)
        }
      }
    }

    void poll()

    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [enabled, pollMs, tick])

  return {
    snapshot,
    loading,
    error,
    refresh: () => {
      setLoading(true)
      setTick((value) => value + 1)
    },
  }
}
