import { useMemo, useState } from 'react'
import { getMockSessionHistory } from '../progressAnalytics'
import { MAX_KPA } from '../constants/insole'
import { useI18n } from '../i18n/context'
import type { TherapistPageProps } from '../types/components'
import type { TherapistSection } from '../types/navigation'
import { StatusSummary } from '../components/layout/StatusSummary'
import { TherapistSectionTabs } from '../components/progress/TherapistSectionTabs'
import { DashboardControls } from '../components/feet/DashboardControls'
import { LiveInactiveCard } from '../components/session/LiveInactiveCard'
import { FeetPressurePanel } from '../components/feet/FeetPressurePanel'
import { ProgressDashboard } from '../components/progress/ProgressDashboard'


export function TherapistPage({
  dashboard,
  frame,
  liveInactive,
  setShowSensors,
  setSource,
  showSensors,
  source,
  status,
}: TherapistPageProps) {
  const { t } = useI18n()
  const [activeSection, setActiveSection] = useState<TherapistSection>('live')
  const sessionMetrics = useMemo(() => getMockSessionHistory(), [])

  return (
    <>
      <section className="hero hero--compact">
        <div>
          <p className="eyebrow">{t.therapist.eyebrow}</p>
          <h1>{t.therapist.title}</h1>
          <p className="lede">{t.therapist.lede}</p>
        </div>

        <StatusSummary dynamicScale={dashboard.dynamicScale} source={source} status={status} />
      </section>

      <TherapistSectionTabs activeSection={activeSection} setActiveSection={setActiveSection} />

      {activeSection === 'live' ? (
        <>
          <DashboardControls
            frame={frame}
            setShowSensors={setShowSensors}
            setSource={setSource}
            showSensors={showSensors}
            source={source}
          />

          {frame?.error && <p className="error">{frame.error}</p>}

          {liveInactive ? (
            <LiveInactiveCard variant="therapist" />
          ) : (
            <FeetPressurePanel dashboard={dashboard} showSensors={showSensors} />
          )}

          {!liveInactive && (
            <section className="bottom-grid">
              <div className="balance-card">
                <div>
                  <p className="eyebrow">{t.live.weight}</p>
                  <h2>{t.live.leftRight(dashboard.leftShare)}</h2>
                </div>
                <div className="balance-track">
                  <div style={{ width: `${dashboard.leftShare}%` }} />
                </div>
              </div>
              <div className="legend">
                <div>
                  <p className="eyebrow">{t.live.pressureScale}</p>
                  <h2>
                    0 - {MAX_KPA} {t.live.kpa}
                  </h2>
                </div>
                <div className="legend-bar" />
              </div>
            </section>
          )}
        </>
      ) : (
        <ProgressDashboard metrics={sessionMetrics} />
      )}
    </>
  )
}
