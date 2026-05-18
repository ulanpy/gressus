import { useMemo, useState } from 'react'
import '../App.css'
import type { SourceMode } from '../types/insole'
import type { ViewMode } from '../types/navigation'
import type { Language } from '../types/i18n'
import { INSOLE_SIZE } from '../constants/insole'
import { translations } from '../i18n/translations'
import { I18nContext } from '../i18n/context'
import { useGeometry } from '../hooks/useGeometry'
import { useInsoleFrame } from '../hooks/useInsoleFrame'
import { useRuntimeControls } from '../hooks/useRuntimeControls'
import { useFootDashboard } from '../hooks/useFootDashboard'
import { PageTabs } from '../components/layout/PageTabs'
import { LanguageToggle } from '../components/layout/LanguageToggle'
import { TherapistPage } from '../pages/TherapistPage'
import { PatientPage } from '../pages/PatientPage'
import { ControlPage } from '../pages/ControlPage'

export function App() {
  const [activeView, setActiveView] = useState<ViewMode>('therapist')
  const [language, setLanguage] = useState<Language>('ru')
  const [source, setSource] = useState<SourceMode>('mock')
  const [showSensors, setShowSensors] = useState(true)
  const runtime = useRuntimeControls()
  const isGameRunning =
    runtime.state.state === 'running' && runtime.state.activeJob?.name === 'game'
  const liveGateOpen = source === 'mock' || isGameRunning
  const liveInactive = source === 'live' && !isGameRunning
  const { geometry, setStatus, status } = useGeometry(INSOLE_SIZE)
  const { frame, patientSuggestion } = useInsoleFrame(source, INSOLE_SIZE, setStatus, liveGateOpen)
  const dashboard = useFootDashboard(geometry, frame)
  const i18n = useMemo(() => ({ language, t: translations[language] }), [language])

  return (
    <I18nContext.Provider value={i18n}>
      <main className="dashboard">
        <div className="top-bar">
          <PageTabs activeView={activeView} setActiveView={setActiveView} />
          <LanguageToggle language={language} setLanguage={setLanguage} />
        </div>

        {activeView === 'therapist' && (
          <TherapistPage
            dashboard={dashboard}
            frame={frame}
            liveInactive={liveInactive}
            setShowSensors={setShowSensors}
            setSource={setSource}
            showSensors={showSensors}
            source={source}
            status={status}
          />
        )}

        {activeView === 'patient' && (
          <PatientPage
            dashboard={dashboard}
            frame={frame}
            liveInactive={liveInactive}
            movementMessage={patientSuggestion}
          />
        )}

        {activeView === 'control' && (
          <ControlPage
            runtime={runtime.state}
            runtimeActionError={runtime.actionError}
            runtimePending={runtime.pending}
            startCalibration={runtime.startCalibration}
            startGame={runtime.startGame}
            stopRuntime={runtime.stopRuntime}
          />
        )}
      </main>
    </I18nContext.Provider>
  )
}

export default App
