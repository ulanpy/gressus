import { useEffect, useRef, useState } from 'react'
import type { FramePayload, InsoleSize, SourceMode } from '../types/insole'
import type { PatientSuggestionState } from '../types/patient'
import { PATIENT_WAITING_MESSAGE } from '../constants/insole'
import { websocketUrl } from '../lib/websocket'
import { updatePatientSuggestion } from '../lib/patient/suggestion'


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

    const ws = new WebSocket(websocketUrl(source, size))

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
