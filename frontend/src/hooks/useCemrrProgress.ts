import { useCallback, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/context'
import { computeCemrr } from '../lib/cemrr/pipeline'
import { CemrrCsvParseError, parseCemrrCsv } from '../lib/cemrr/csv'
import { buildCemrrRecommendations } from '../lib/cemrr/recommendations'
import { CEMRR_EXAMPLE_INPUTS } from '../lib/cemrr/example'
import type { CemrrInput, CemrrResult } from '../types/cemrr'
import type { CemrrRecommendation } from '../types/cemrr'

export type CemrrProgressState = {
  inputs: CemrrInput[]
  activeSession: number | null
  error: string | null
  results: CemrrResult[]
  activeResult: CemrrResult | null
  recommendations: CemrrRecommendation[]
  handleText: (text: string) => void
  handleLoadExample: () => void
  handleClear: () => void
  setActiveSession: (session: number) => void
}

export function useCemrrProgress(): CemrrProgressState {
  const { t } = useI18n()
  const [inputs, setInputs] = useState<CemrrInput[]>([])
  const [activeSession, setActiveSession] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tRef = useRef(t)
  tRef.current = t

  const results = useMemo<CemrrResult[]>(
    () => inputs.map((input) => computeCemrr(input)),
    [inputs],
  )
  const activeResult = useMemo<CemrrResult | null>(() => {
    if (results.length === 0) return null
    if (activeSession === null) return results[results.length - 1]
    return results.find((r) => r.session === activeSession) ?? results[results.length - 1]
  }, [results, activeSession])
  const recommendations = useMemo(
    () => (activeResult ? buildCemrrRecommendations(activeResult) : []),
    [activeResult],
  )

  const handleText = useCallback((text: string) => {
    try {
      const parsed = parseCemrrCsv(text)
      setInputs(parsed.inputs)
      setActiveSession(parsed.inputs[parsed.inputs.length - 1]?.session ?? null)
      setError(null)
    } catch (err) {
      const message =
        err instanceof CemrrCsvParseError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'unknown error'
      setError(tRef.current.progress.cemrr.parseError + message)
    }
  }, [])

  const handleLoadExample = useCallback(() => {
    setInputs(CEMRR_EXAMPLE_INPUTS)
    setActiveSession(CEMRR_EXAMPLE_INPUTS[CEMRR_EXAMPLE_INPUTS.length - 1].session)
    setError(null)
  }, [])

  const handleClear = useCallback(() => {
    setInputs([])
    setActiveSession(null)
    setError(null)
  }, [])

  const setActiveSessionStable = useCallback((session: number) => {
    setActiveSession(session)
  }, [])

  return useMemo(
    () => ({
      inputs,
      activeSession,
      error,
      results,
      activeResult,
      recommendations,
      handleText,
      handleLoadExample,
      handleClear,
      setActiveSession: setActiveSessionStable,
    }),
    [
      inputs,
      activeSession,
      error,
      results,
      activeResult,
      recommendations,
      handleText,
      handleLoadExample,
      handleClear,
      setActiveSessionStable,
    ],
  )
}
