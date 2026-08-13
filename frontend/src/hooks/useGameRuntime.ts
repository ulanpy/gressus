import { useCallback, useState } from 'react'
import { startCameraCalibration, startGame, stopRuntimeStack } from '../lib/api/runtime'
import type { GameLaunchParams } from '../types/runtime'
import { useRuntimeStatus } from './useRuntimeStatus'

export function useGameRuntime() {
  const status = useRuntimeStatus()
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setPending(true)
    setActionError(null)
    try {
      await action()
      status.refresh()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'runtime action failed')
    } finally {
      setPending(false)
    }
  }, [status])

  return {
    ...status,
    pending,
    actionError,
    startGame: (params: GameLaunchParams) => run(() => startGame(params)),
    startCalibration: (rotation: number) => run(() => startCameraCalibration(rotation)),
    stop: () => run(stopRuntimeStack),
  }
}
