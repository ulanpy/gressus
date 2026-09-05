import { useEffect, useState } from 'react'
import { Activity, ArrowRight, Camera, ChevronLeft, ChevronRight, ClipboardCheck, Footprints, Gamepad2, Layers3, PersonStanding, UserRound } from 'lucide-react'
import type { FootDashboard } from '@/types/insole'
import { useI18n } from '@/i18n/context'
import { formatKpa } from '@/lib/format'
import { FootHeatmap } from '@/widgets/feet/FootHeatmap'
import { Button } from '@/shared/ui/button'
import pressureScenarioArt from '@/assets/scenario-pressure-analysis.png'
import gameScenarioArt from '@/assets/scenario-game.png'
import customScenarioArt from '@/assets/scenario-custom.png'
import exoskeletonScenarioArt from '@/assets/scenario-exoskeleton.png'

function Step({ icon: Icon, number, title, text }: {
  icon: typeof Footprints
  number: string
  title: string
  text: string
}) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
    <div className="flex items-center justify-between"><span className="text-xs font-bold tracking-[0.16em] text-sky-700">{number}</span><Icon className="size-5 text-sky-700" /></div>
    <h3 className="m-0 mt-6 text-lg font-bold tracking-tight">{title}</h3>
    <p className="m-0 mt-2 text-sm leading-6 text-slate-500">{text}</p>
  </article>
}

function Module({ icon: Icon, title, text }: { icon: typeof Footprints; title: string; text: string }) {
  return <article className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5">
    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700"><Icon className="size-5" /></div>
    <div><h3 className="m-0 font-bold">{title}</h3><p className="m-0 mt-1 text-sm leading-6 text-slate-500">{text}</p></div>
  </article>
}

export function OverviewPage({ dashboard, onOpenSessions }: { dashboard: FootDashboard; onOpenSessions: () => void }) {
  const { t } = useI18n()
  const scenarios = [
    { icon: Footprints, artwork: pressureScenarioArt, title: t.overview.pressureScenarioTitle, text: t.overview.pressureScenarioText, equipment: t.overview.pressureScenarioEquipment },
    { icon: Gamepad2, artwork: gameScenarioArt, title: t.overview.gameScenarioTitle, text: t.overview.gameScenarioText, equipment: t.overview.gameScenarioEquipment },
    { icon: PersonStanding, artwork: exoskeletonScenarioArt, title: t.overview.exoskeletonScenarioTitle, text: t.overview.exoskeletonScenarioText, equipment: t.overview.exoskeletonScenarioEquipment },
    { icon: Layers3, artwork: customScenarioArt, title: t.overview.customScenarioTitle, text: t.overview.customScenarioText, equipment: t.overview.customScenarioEquipment },
  ]
  const [scenarioIndex, setScenarioIndex] = useState(0)
  const scenario = scenarios[scenarioIndex]

  useEffect(() => {
    const timer = window.setInterval(() => setScenarioIndex((index) => (index + 1) % scenarios.length), 5000)
    return () => window.clearInterval(timer)
  }, [scenarios.length])

  return <div className="mx-auto w-full max-w-6xl space-y-14 pb-10 text-slate-900">
    <section className="grid overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-panel lg:grid-cols-[1.05fr_0.95fr]">
      <div className="p-8 sm:p-12">
        <p className="m-0 text-xs font-bold tracking-[0.14em] text-sky-700 uppercase">Gressus</p>
        <h1 className="m-0 mt-5 max-w-xl text-4xl font-bold leading-[0.98] tracking-[-0.05em] sm:text-6xl">{t.overview.title}</h1>
        <p className="m-0 mt-6 max-w-lg text-base leading-7 text-slate-600">{t.overview.description}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button type="button" size="lg" onClick={onOpenSessions}>{t.overview.openSessions}<ArrowRight className="size-4" /></Button>
          <span className="text-sm font-medium text-slate-500">{t.overview.eyebrow}</span>
        </div>
      </div>

      <div className="min-h-96 bg-[radial-gradient(circle_at_25%_20%,#b9efff_0,transparent_38%),radial-gradient(circle_at_85%_90%,#bef4df_0,transparent_38%),#eaf5f8] p-7 sm:p-10">
        <div className="grid h-full content-center gap-4 sm:grid-cols-2">
          <div className="flex min-h-28 items-center gap-3 rounded-2xl border border-white/80 bg-white/80 p-4 shadow-lg backdrop-blur">
            <div className="grid size-10 place-items-center rounded-xl bg-sky-100 text-sky-700"><UserRound className="size-5" /></div>
            <div><p className="m-0 text-xs font-semibold text-slate-400">01</p><p className="m-0 text-sm font-bold">{t.overview.visualPatient}</p></div>
          </div>
          <div className="flex min-h-28 items-center gap-3 rounded-2xl border border-white/80 bg-white/80 p-4 shadow-lg backdrop-blur">
            <div className="grid size-10 place-items-center rounded-xl bg-sky-100 text-sky-700"><ClipboardCheck className="size-5" /></div>
            <div><p className="m-0 text-xs font-semibold text-slate-400">02</p><p className="m-0 text-sm font-bold">{t.overview.visualSession}</p></div>
          </div>
          <div className="flex min-h-28 items-center gap-3 rounded-2xl border border-white/80 bg-white/80 p-4 shadow-lg backdrop-blur">
            <div className="flex -space-x-3"><div className="w-12"><FootHeatmap frame={dashboard.leftFrame} scale={dashboard.dynamicScale} showSensors={false} silhouette={dashboard.leftSilhouette} idPrefix="overview-left" title="" /></div><div className="w-12"><FootHeatmap frame={dashboard.rightFrame} scale={dashboard.dynamicScale} showSensors={false} silhouette={dashboard.rightSilhouette} idPrefix="overview-right" title="" /></div></div>
            <div><p className="m-0 text-xs font-semibold text-slate-400">03</p><p className="m-0 text-sm font-bold">{t.overview.visualScenarios}</p></div>
          </div>
          <div className="flex min-h-28 items-center gap-3 rounded-2xl border border-white/80 bg-white/80 p-4 shadow-lg backdrop-blur">
            <div className="grid size-10 place-items-center rounded-xl bg-sky-100 text-sky-700"><Activity className="size-5" /></div>
            <div><p className="m-0 text-xs font-semibold text-slate-400">04</p><p className="m-0 text-sm font-bold">{t.overview.visualResult}</p></div>
          </div>
        </div>
      </div>
    </section>

    <section>
      <p className="m-0 text-sm font-bold tracking-[0.12em] text-sky-700 uppercase">{t.overview.flowTitle}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Step number="01" icon={UserRound} title={t.overview.profileTitle} text={t.overview.profileText} />
        <Step number="02" icon={Layers3} title={t.overview.scenarioSetupTitle} text={t.overview.scenarioSetupText} />
        <Step number="03" icon={ClipboardCheck} title={t.overview.recordTitle} text={t.overview.recordText} />
        <Step number="04" icon={Activity} title={t.overview.analyticsTitle} text={t.overview.analyticsText} />
      </div>
    </section>

    <section>
      <p className="m-0 text-sm font-bold tracking-[0.12em] text-sky-700 uppercase">{t.overview.scenarioTitle}</p>
      <div className="mt-4 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-panel">
        <div className="grid min-h-64 md:grid-cols-[0.75fr_1.25fr]">
          <div className="flex flex-col justify-between bg-slate-900 p-7 text-white sm:p-8">
            <div>
              <p className="m-0 text-xs font-bold tracking-[0.14em] text-cyan-300 uppercase">{String(scenarioIndex + 1).padStart(2, '0')} / 04</p>
              <div className="mt-7 grid h-28 w-full place-items-center overflow-hidden sm:h-32">
                {scenario.artwork
                  ? <div
                      aria-hidden="true"
                      className="h-full w-full bg-center bg-no-repeat mix-blend-screen"
                      style={{ backgroundImage: `url(${scenario.artwork})`, backgroundSize: 'contain' }}
                    />
                  : <div className="grid size-24 place-items-center rounded-3xl bg-white/5"><scenario.icon className="size-10 text-cyan-300" /></div>}
              </div>
            </div>
            <div className="mt-8 flex items-center gap-2">
              {scenarios.map((item, index) => <button key={item.title} type="button" aria-label={item.title} onClick={() => setScenarioIndex(index)} className={`h-2 rounded-full transition-all ${index === scenarioIndex ? 'w-7 bg-cyan-300' : 'w-2 bg-white/30 hover:bg-white/60'}`} />)}
            </div>
          </div>
          <div className="flex flex-col justify-between p-7 sm:p-8">
            <div>
              <h2 className="m-0 text-2xl font-bold tracking-tight">{scenario.title}</h2>
              <p className="m-0 mt-3 max-w-xl text-sm leading-6 text-slate-600">{scenario.text}</p>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-2">
              {scenario.equipment.split(' · ').map((item) => <span key={item} className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">{item}</span>)}
              <div className="ml-auto flex gap-2"><button type="button" aria-label="Previous scenario" onClick={() => setScenarioIndex((scenarioIndex + scenarios.length - 1) % scenarios.length)} className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><ChevronLeft className="size-4" /></button><button type="button" aria-label="Next scenario" onClick={() => setScenarioIndex((scenarioIndex + 1) % scenarios.length)} className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><ChevronRight className="size-4" /></button></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-[28px] bg-slate-900 p-7 text-white sm:p-8">
        <p className="m-0 text-xs font-bold tracking-[0.14em] text-cyan-300 uppercase">{t.overview.demoKicker}</p>
        <h2 className="m-0 mt-4 text-3xl font-bold tracking-tight">{t.overview.demoTitle}</h2>
        <p className="m-0 mt-3 max-w-sm text-sm leading-6 text-slate-300">{t.overview.demoText}</p>
        <div className="mt-7 flex items-end justify-center gap-4 rounded-2xl bg-white/8 p-5">
          <div className="grid justify-items-center gap-2"><div className="w-20"><FootHeatmap frame={dashboard.leftFrame} scale={dashboard.dynamicScale} showSensors={false} silhouette={dashboard.leftSilhouette} idPrefix="overview-demo-left" title="" /></div><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">L · {formatKpa(dashboard.leftFrame.stats.maxKpa)}</span></div>
          <div className="grid justify-items-center gap-2"><div className="w-20"><FootHeatmap frame={dashboard.rightFrame} scale={dashboard.dynamicScale} showSensors={false} silhouette={dashboard.rightSilhouette} idPrefix="overview-demo-right" title="" /></div><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">R · {formatKpa(dashboard.rightFrame.stats.maxKpa)}</span></div>
        </div>
      </div>
      <div>
        <p className="m-0 text-sm font-bold tracking-[0.12em] text-sky-700 uppercase">{t.overview.equipmentTitle}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Module icon={Footprints} title={t.overview.insolesTitle} text={t.overview.insolesText} />
          <Module icon={Camera} title={t.overview.projectionTitle} text={t.overview.projectionText} />
          <Module icon={Activity} title={t.overview.exoskeletonTitle} text={t.overview.exoskeletonText} />
          <Module icon={Layers3} title={t.overview.integrationTitle} text={t.overview.integrationText} />
        </div>
      </div>
    </section>
  </div>
}
