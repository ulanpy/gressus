import { useMemo, useState } from 'react'
import type { SourceMode } from '../types/insole'
import type { ViewMode } from '../types/navigation'
import type { Language } from '../types/i18n'
import { INSOLE_SIZE } from '../constants/insole'
import { I18nContext, useI18n } from '../i18n/context'
import { translations } from '../i18n/translations'
import { useGeometry } from '../hooks/useGeometry'
import { useInsoleFrame } from '../hooks/useInsoleFrame'
import { usePatientSessionWorkflow } from '../hooks/usePatientSessionWorkflow'
import { useFootDashboard } from '../hooks/useFootDashboard'
import { AppNavigation } from '@/shared/layout/AppNavigation'
import { LanguageToggle } from '@/shared/layout/LanguageToggle'
import type { PatientWorkspaceView } from '@/widgets/patients/PatientViewMenu'
import { TherapistPage } from '../pages/TherapistPage'
import { ControlPage } from '../pages/ControlPage'
import { ExoskeletonControl } from '../pages/ExoskeletonControl'

type DashboardShellProps = {
  language: Language
  setLanguage: (language: Language) => void
}

function DashboardShell({ language, setLanguage }: DashboardShellProps) {
  const { t } = useI18n()
  const [activeView, setActiveView] = useState<ViewMode>('therapist')
  const [workspaceView, setWorkspaceView] = useState<PatientWorkspaceView>('sessions')
  const [source, setSource] = useState<SourceMode>('mock')
  const [showSensors, setShowSensors] = useState(true)
  const workflow = usePatientSessionWorkflow()
  const liveGateOpen = activeView === 'therapist'
  const liveInactive = false
  const { geometry, setStatus, status } = useGeometry(INSOLE_SIZE)
  const { frame } = useInsoleFrame(source, INSOLE_SIZE, setStatus, liveGateOpen)
  const dashboard = useFootDashboard(geometry, frame)

  return (
    <main className="min-h-screen bg-background">
      <div className="page-shell">
        <div className="page-header">
          <AppNavigation
            activeView={activeView}
            setActiveView={setActiveView}
            workflow={workflow}
          />
          <div className="flex items-center gap-3">
            {workflow.selectedPatient && workflow.activeSession && activeView !== 'control' && (
              <span className="rounded-xl border border-border bg-white px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap text-slate-800 shadow-panel">
                {t.workflow.contextBadge(
                  workflow.selectedPatient.display_name,
                  workflow.activeSession.session_number ?? 0,
                )}
              </span>
            )}
            <LanguageToggle language={language} setLanguage={setLanguage} />
          </div>
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

        {activeView === 'control' && (
          <ControlPage
            workflow={workflow}
            workspaceView={workspaceView}
            onWorkspaceViewChange={setWorkspaceView}
          />
        )}

        {activeView === 'exoskeleton' && <ExoskeletonControl />}
      </div>
    </main>
  )
}

export function App() {
  const [language, setLanguage] = useState<Language>('ru')
  const i18n = useMemo(() => ({ language, t: translations[language] }), [language])

  return (
    <I18nContext.Provider value={i18n}>
      <DashboardShell language={language} setLanguage={setLanguage} />
    </I18nContext.Provider>
  )
}

export default App
