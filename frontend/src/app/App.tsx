import { useMemo, useState } from 'react'
import type { ViewMode } from '../types/navigation'
import type { Language } from '../types/i18n'
import { I18nContext } from '../i18n/context'
import { translations } from '../i18n/translations'
import { usePatientSessionWorkflow } from '../hooks/usePatientSessionWorkflow'
import { AppNavigation } from '@/shared/layout/AppNavigation'
import { LanguageToggle } from '@/shared/layout/LanguageToggle'
import type { PatientWorkspaceView } from '@/widgets/patients/PatientViewMenu'
import { OverviewPage } from '../pages/OverviewPage'
import { ControlPage } from '../pages/ControlPage'
import { SessionsControlPanel } from '@/widgets/sessions/SessionsControlPanel'

type DashboardShellProps = {
  language: Language
  setLanguage: (language: Language) => void
}

function DashboardShell({ language, setLanguage }: DashboardShellProps) {
  const [activeView, setActiveView] = useState<ViewMode>('therapist')
  const [workspaceView, setWorkspaceView] = useState<PatientWorkspaceView>('sessions')
  const workflow = usePatientSessionWorkflow()

  return (
    <main className="min-h-screen bg-background">
      <div className="page-shell">
        <div className="page-header">
          <AppNavigation
            activeView={activeView}
            setActiveView={setActiveView}
            workflow={workflow}
          />
          <LanguageToggle language={language} setLanguage={setLanguage} />
        </div>

        {activeView === 'therapist' && (
          <OverviewPage onOpenSessions={() => setActiveView('sessions')} />
        )}

        {activeView === 'control' && (
          <ControlPage
            workflow={workflow}
            workspaceView={workspaceView}
            onWorkspaceViewChange={setWorkspaceView}
          />
        )}

        {activeView === 'sessions' && <SessionsControlPanel workflow={workflow} />}
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
