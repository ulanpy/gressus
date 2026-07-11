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
import { PageTabs } from '../components/layout/PageTabs'
import { LanguageToggle } from '../components/layout/LanguageToggle'
import { TherapistPage } from '../pages/TherapistPage'
import { ControlPage } from '../pages/ControlPage'
import { ExoskeletonControl } from '../pages/ExoskeletonControl'
import { container } from '../styles/ui'
import { cn } from '../lib/cn'

type DashboardShellProps = {
  language: Language
  setLanguage: (language: Language) => void
}

function DashboardShell({ language, setLanguage }: DashboardShellProps) {
  const { t } = useI18n()
  const [activeView, setActiveView] = useState<ViewMode>('therapist')
  const [source, setSource] = useState<SourceMode>('mock')
  const [showSensors, setShowSensors] = useState(true)
  const workflow = usePatientSessionWorkflow()
  const liveGateOpen = activeView === 'therapist'
  const liveInactive = false
  const { geometry, setStatus, status } = useGeometry(INSOLE_SIZE)
  const { frame } = useInsoleFrame(source, INSOLE_SIZE, setStatus, liveGateOpen)
  const dashboard = useFootDashboard(geometry, frame)

  return (
    <main className="min-h-screen px-6 py-12 max-[980px]:px-4 max-[980px]:py-8">
      <div
        className={cn(
          container,
          'mb-7 flex items-center justify-between gap-3 max-sm:grid',
        )}
      >
        <PageTabs activeView={activeView} setActiveView={setActiveView} />
        <div className="flex items-center gap-3">
          {workflow.selectedPatient && workflow.activeSession && (
            <span className="rounded-full bg-slate-900 px-3.5 py-2 text-[13px] font-bold whitespace-nowrap text-white">
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

      {activeView === 'control' && <ControlPage workflow={workflow} />}

      {activeView === 'exoskeleton' && <ExoskeletonControl />}
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
