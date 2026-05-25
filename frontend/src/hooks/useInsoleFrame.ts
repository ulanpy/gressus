import { useEffect, useRef, useState } from 'react'
import type { FramePayload, InsoleSize, SourceMode } from '../types/insole'
import type { PatientSuggestionState } from '../types/patient'
import { PATIENT_WAITING_MESSAGE } from '../constants/insole'
import { websocketUrl } from '../lib/websocket'
import { updatePatientSuggestion } from '../lib/patient/suggestion'

const SENSOR_COUNT = 64
const MOCK_HZ = 20


export function useInsoleFrame(
  source: SourceMode,
  size: InsoleSize,
  setStatus: React.Dispatch<React.SetStateAction<string>>,
  gateOpen: boolean,
) {
  const [frame, setFrame] = useState<FramePayload | null>(null)
  const [patientSuggestion, setPatientSuggestion] = useState(PATIENT_WAITING_MESSAGE)
  const patientSuggestionState = useRef<PatientSuggestionState>({
    contactKey: 'none',
    lastSuggestionStep: 0,
    message: PATIENT_WAITING_MESSAGE,
    stepCount: 0,
  })

  useEffect(() => {
    if (!gateOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFrame(null)
      setPatientSuggestion(PATIENT_WAITING_MESSAGE)
      patientSuggestionState.current = {
        contactKey: 'none',
        lastSuggestionStep: 0,
        message: PATIENT_WAITING_MESSAGE,
        stepCount: 0,
      }
      setStatus('ожидание запуска')
      return
    }

    if (source === 'mock') {
      setStatus('подключено')
      const startedAt = performance.now()
      let seq = 0
      let lastEmit = 0
      let rafId = 0
      const minIntervalMs = 1000 / MOCK_HZ

      const tick = (now: number) => {
        if (now - lastEmit >= minIntervalMs) {
          lastEmit = now
          const nextFrame = createMockFrame(startedAt, seq)
          seq += 1
          setFrame(nextFrame)
          setPatientSuggestion(
            updatePatientSuggestion(patientSuggestionState.current, nextFrame),
          )
        }
        rafId = window.requestAnimationFrame(tick)
      }
      rafId = window.requestAnimationFrame(tick)

      return () => window.cancelAnimationFrame(rafId)
    }

    const ws = new WebSocket(websocketUrl(size))

    ws.onopen = () => setStatus('подключено')
    ws.onmessage = (event) => {
      const nextFrame = JSON.parse(event.data) as FramePayload

      setFrame(nextFrame)
      setPatientSuggestion(updatePatientSuggestion(patientSuggestionState.current, nextFrame))
      setStatus('подключено')
    }
    ws.onerror = () => setStatus('ошибка сокета')
    ws.onclose = () => setStatus('отключено')

    return () => ws.close()
  }, [setStatus, source, size, gateOpen])

  return { frame, patientSuggestion }
}

function createMockFrame(startedAtMs: number, seq: number): FramePayload {
  const nowMs = performance.now()
  const t = (nowMs - startedAtMs) / 1000
  const stepPhase = t * 1.8
  const leftLoad = 0.5 + 0.5 * Math.sin(stepPhase)
  const rightLoad = 0.5 + 0.5 * Math.sin(stepPhase + Math.PI)
  const leftValues = buildMockFootValues(leftLoad, t)
  const rightValues = buildMockFootValues(rightLoad, t + 0.31)

  return {
    source: 'mock',
    available: true,
    gameRunning: true,
    seq,
    dtMs: Math.round(1000 / MOCK_HZ),
    connected: true,
    ageS: 0,
    error: null,
    leftOnline: true,
    rightOnline: true,
    left: leftValues,
    right: rightValues,
    leftStats: buildFootStats(leftValues),
    rightStats: buildFootStats(rightValues),
  }
}

function buildMockFootValues(load: number, t: number): number[] {
  const heelWeight = 0.6 + 0.4 * Math.sin(t * 2.3)
  const toeWeight = 1 - heelWeight

  return Array.from({ length: SENSOR_COUNT }, (_, index) => {
    const row = Math.floor(index / 8) / 7
    const col = (index % 8) / 7
    const arch = 1 - Math.abs(col - 0.5) * 1.8
    const heel = 1 - row
    const toe = row
    const phase = heel * heelWeight + toe * toeWeight
    const envelope = Math.max(0, 18 + load * 185 * phase * Math.max(0.2, arch))
    const micro = Math.sin(t * 4 + index * 0.6) * 4

    return Math.max(0, Math.round(envelope + micro))
  })
}

function buildFootStats(values: number[]) {
  const sumKpa = values.reduce((sum, value) => sum + value, 0)
  const maxKpa = values.reduce((max, value) => Math.max(max, value), 0)
  const meanKpa = values.length ? sumKpa / values.length : 0

  return {
    maxKpa,
    meanKpa,
    sumKpa,
    pressed: maxKpa > 8,
    hasData: true,
  }
}
