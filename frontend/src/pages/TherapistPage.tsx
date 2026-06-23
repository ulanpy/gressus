import { MAX_KPA } from '../constants/insole'
import { useI18n } from '../i18n/context'
import type { TherapistPageProps } from '../types/components'
import { StatusSummary } from '../components/layout/StatusSummary'
import { TherapistSectionTabs } from '../components/progress/TherapistSectionTabs'
import { DashboardControls } from '../components/feet/DashboardControls'
import { LiveInactiveCard } from '../components/session/LiveInactiveCard'
import { FeetPressurePanel } from '../components/feet/FeetPressurePanel'
import { ProgressDashboard } from '../components/progress/ProgressDashboard'
import { cn } from '../lib/cn'
import { container, eyebrow, panel } from '../styles/ui'

const pressureGradient =
  'bg-gradient-to-r from-cyan-400 via-emerald-500 via-amber-300 to-orange-500'


export function TherapistPage({
  dashboard,
  frame,
  liveInactive,
  setShowSensors,
  setSource,
  showSensors,
  source,
  status,
  cemrr,
  activeSection,
  setActiveSection,
}: TherapistPageProps) {
  const { t } = useI18n()

  return (
    <>
      <section
        className={cn(
          container,
          'mb-2 grid grid-cols-1 items-end gap-8 min-[981px]:grid-cols-[minmax(0,1fr)_360px]',
        )}
      >
        <div>
          <p className={cn(eyebrow, 'inline-flex items-center gap-2')}>
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500"
              aria-hidden
            />
            {t.therapist.eyebrow}
          </p>
          <h1 className="m-0 max-w-[760px] text-[clamp(32px,6vw,56px)] leading-[0.95] tracking-[-0.06em] text-text-strong">
            {t.therapist.title}
          </h1>
          {/* <p className="mt-6 mb-0 max-w-[680px] text-lg leading-[1.7] text-muted">{t.therapist.lede}</p> */}
        </div>

        {/* <StatusSummary dynamicScale={dashboard.dynamicScale} source={source} status={status} /> */}
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

          {frame?.error && (
            <p
              className={cn(
                container,
                'mt-[18px] rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-red-800',
              )}
            >
              {frame.error}
            </p>
          )}

          {liveInactive ? (
            <LiveInactiveCard variant="therapist" />
          ) : (
            <FeetPressurePanel dashboard={dashboard} showSensors={showSensors} />
          )}

          {!liveInactive && (
            <section
              className={cn(
                container,
                'mt-6 grid grid-cols-1 gap-6 min-[981px]:grid-cols-[minmax(0,1fr)_360px]',
              )}
            >
              <div className={cn(panel, 'rounded-[28px] p-6')}>
                <div>
                  <p className={eyebrow}>{t.live.weight}</p>
                  <h2 className="m-0 text-[26px] tracking-[-0.04em] text-text-strong">
                    {t.live.leftRight(dashboard.leftShare)}
                  </h2>
                </div>
                <div className="mt-[22px] h-3.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={cn(
                      'h-full rounded-[inherit] transition-[width] duration-[120ms] linear',
                      pressureGradient,
                    )}
                    style={{ width: `${dashboard.leftShare}%` }}
                  />
                </div>
              </div>
              <div className={cn(panel, 'rounded-[28px] p-6')}>
                <div>
                  <p className={eyebrow}>{t.live.pressureScale}</p>
                  <h2 className="m-0 text-[26px] tracking-[-0.04em] text-text-strong">
                    0 - {MAX_KPA} {t.live.kpa}
                  </h2>
                </div>
                <div className={cn('mt-[22px] h-3.5 overflow-hidden rounded-full', pressureGradient)} />
              </div>
            </section>
          )}
        </>
      ) : (
        <ProgressDashboard cemrr={cemrr} />
      )}
    </>
  )
}
