import type { FramePayload } from '../../types/insole'
import type { PatientContactKey } from '../../types/navigation'
import type { PatientMessageKey } from '../../types/i18n'
import type { PatientSuggestionState } from '../../types/patient'
import { PATIENT_WAITING_MESSAGE, SUGGESTION_STEP_INTERVAL } from '../../constants/insole'


export function updatePatientSuggestion(state: PatientSuggestionState, frame: FramePayload) {
  const leftActive = frame.leftStats.pressed
  const rightActive = frame.rightStats.pressed
  const leftShare = patientLeftShare(frame.leftStats.sumKpa, frame.rightStats.sumKpa)
  const contactKey = patientContactKey(leftActive, rightActive)
  const immediateMessage = patientMovementMessage(leftActive, rightActive, leftShare)

  if (contactKey === 'none') {
    state.contactKey = contactKey
    state.lastSuggestionStep = state.stepCount
    state.message = immediateMessage

    return state.message
  }

  const stepCount = contactKey === state.contactKey ? state.stepCount : state.stepCount + 1
  const shouldUpdate =
    state.message === PATIENT_WAITING_MESSAGE ||
    stepCount - state.lastSuggestionStep >= SUGGESTION_STEP_INTERVAL

  state.contactKey = contactKey
  state.stepCount = stepCount

  if (shouldUpdate) {
    state.lastSuggestionStep = stepCount
    state.message = immediateMessage
  }

  return state.message
}

export function patientMovementMessage(leftActive: boolean, rightActive: boolean, leftShare: number): PatientMessageKey {
  if (!leftActive && !rightActive) {
    return PATIENT_WAITING_MESSAGE
  }

  if (leftActive !== rightActive) {
    return 'keepWalking'
  }

  if (leftShare > 60) {
    return 'softerLeft'
  }

  if (leftShare < 40) {
    return 'softerRight'
  }

  return 'evenStep'
}

export function patientLeftShare(leftLoad: number, rightLoad: number) {
  const totalLoad = leftLoad + rightLoad

  return totalLoad > 0 ? Math.round((leftLoad / totalLoad) * 100) : 50
}

export function patientContactKey(leftActive: boolean, rightActive: boolean): PatientContactKey {
  if (leftActive && rightActive) {
    return 'both'
  }

  if (leftActive) {
    return 'left'
  }

  if (rightActive) {
    return 'right'
  }

  return 'none'
}
