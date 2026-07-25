import { cn } from '@/shared/lib/utils'

/** Shared Tailwind class fragments for the Gressus design system. */

export const container = 'w-full max-w-[1280px] mx-auto'

export const panel =
  'border border-border bg-card shadow-panel'

export const eyebrow = 'page-eyebrow mb-2.5'

export const progressCard = cn(panel, 'rounded-2xl p-6')

export const workflowStep = cn(panel, 'rounded-2xl bg-card p-6')

export const workflowMuted = 'text-muted mt-3 mb-0'

export const sessionCard =
  'flex justify-between gap-4 items-start mt-3 p-4 rounded-[18px] bg-slate-50'

export const sessionCardMeta = 'text-muted text-sm'

export const sessionHistoryBlock = 'mt-5'

export const sessionHistory = 'list-none mt-3 mb-0 p-0 grid gap-2.5'

export const sessionHistoryItem = 'px-4 py-3.5 rounded-2xl bg-slate-50'

export const sessionHistoryStatus = 'ml-2.5 text-muted text-[13px]'

export const sessionHistoryNotes = 'mt-2 mb-0 text-slate-600'

export const cemrrCard = cn(panel, 'grid gap-3.5 min-w-0 rounded-3xl p-5')

export const cemrrCardHead =
  'flex justify-between items-baseline gap-3.5 flex-wrap [&_.eyebrow]:m-0'

export const cemrrCardFormula =
  'inline-block px-2.5 py-1 rounded-lg bg-slate-900/[0.06] font-mono text-[11px] text-text-strong'

export const cemrrGrid = 'grid gap-[18px]'

export const cemrrGridTwo =
  'grid gap-[18px] grid-cols-2 max-[980px]:grid-cols-1'

export const cemrrUpload = cn(panel, 'grid gap-3 rounded-3xl p-[18px]')

export const cemrrUploadDrop =
  'grid content-center justify-items-center gap-1.5 p-6 border-2 border-dashed border-panel-border rounded-[18px] text-text-strong bg-white/60 cursor-pointer transition-[border-color,background] duration-[120ms] hover:border-cyan-400 hover:bg-cyan-50 [&_strong]:text-sm [&_strong]:font-semibold'

export const cemrrUploadDropActive = 'border-cyan-400 bg-cyan-50'

export const cemrrUploadDropIcon = 'text-[28px] opacity-60'

export const cemrrUploadDropSub = 'text-muted text-xs'

export const cemrrUploadActions = 'flex flex-wrap items-center gap-2.5'

export const cemrrUploadCount = 'text-[13px] text-muted [&_strong]:text-text-strong [&_strong]:tabular-nums'

export const cemrrUploadError =
  'm-0 px-3.5 py-2.5 rounded-[14px] bg-red-100/70 text-red-800 text-[13px]'

export const cemrrHero = cn(
  panel,
  'grid grid-cols-[140px_minmax(0,1fr)] max-[980px]:grid-cols-1 gap-6 items-center bg-gradient-to-br from-panel to-cyan-50/70 rounded-[28px] p-6',
)

export const cemrrHeroCircle =
  'grid justify-items-center content-center w-[130px] h-[130px] border-4 border-solid rounded-full bg-white'

export const cemrrHeroCircleValue =
  'text-[32px] font-bold tabular-nums tracking-[-0.04em]'

export const cemrrHeroCircleLabel =
  'text-[11px] text-muted tracking-[0.18em] uppercase mt-1'

export const cemrrHeroBody = 'min-w-0'

export const cemrrHeroTitle =
  'm-1 mb-3.5 text-text-strong text-[22px] tracking-[-0.02em]'

export const cemrrHeroBars = 'grid gap-2'

export const cemrrHeroBar =
  'grid grid-cols-[200px_minmax(0,1fr)_44px] max-[980px]:grid-cols-[minmax(0,1fr)_auto] gap-3 items-center'

export const cemrrHeroBarLabel = 'text-muted text-xs'

export const cemrrHeroBarTrack =
  'h-1.5 bg-slate-200 rounded-full overflow-hidden max-[980px]:col-span-full max-[980px]:order-3'

export const cemrrHeroBarFill =
  'h-full rounded-full transition-[width] duration-[320ms] ease-out'

export const cemrrHeroBarPct = 'text-right text-xs font-bold tabular-nums'

export const cemrrAspects =
  'grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3'

export const cemrrAspect = cn(
  'grid gap-1.5 border-l-[3px] border-panel-border rounded-[14px] bg-slate-100/50 p-3.5',
)

export const cemrrAspectHead =
  'flex items-center justify-between gap-2 text-xs text-text-strong font-semibold'

export const cemrrAspectValue = 'text-[22px] font-bold tabular-nums'

export const cemrrAspectTrack = 'h-1 bg-slate-200 rounded-full overflow-hidden'

export const cemrrAspectFill =
  'h-full rounded-full transition-[width] duration-[320ms] ease-out'

export const cemrrAspectDetail =
  'text-muted text-[11px] font-mono'

export const cemrrAspectPill = 'py-[3px] px-2 rounded-full text-[10px] font-bold'

export const cemrrAspectPillGood = 'bg-emerald-100 text-emerald-700'

export const cemrrAspectPillMid = 'bg-amber-100 text-amber-700'

export const cemrrAspectPillBad = 'bg-red-100 text-red-700'

export const cemrrMetrics = 'grid gap-2'

export const cemrrMetricsTwo = 'grid gap-2 grid-cols-2'

export const cemrrMetric =
  'grid gap-1 p-3 rounded-[14px] bg-slate-100/50 min-w-0 [&_span]:text-[11px] [&_span]:text-muted [&_span]:tracking-[0.06em] [&_span]:uppercase [&_strong]:text-base [&_strong]:text-text-strong [&_strong]:tabular-nums [&_strong]:whitespace-nowrap'

export const cemrrTorqueGrid =
  'grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3'

export const cemrrTorque =
  'grid gap-1.5 p-3 rounded-[14px] bg-slate-100/50'

export const cemrrTorqueJoint =
  'text-[11px] text-muted uppercase tracking-[0.06em]'

export const cemrrTorqueRow =
  'flex justify-between items-baseline gap-2 [&_strong]:text-base [&_strong]:tabular-nums [&_strong]:text-text-strong [&_span]:text-[11px]'

export const cemrrTorquePos = 'text-emerald-500'

export const cemrrTorqueNeg = 'text-red-600'

export const cemrrTorqueTrack = 'h-1 bg-slate-200 rounded-full overflow-hidden'

export const cemrrTorqueFill = 'h-full rounded-full bg-violet-400'

export const cemrrTorqueCaption = 'text-[11px] text-muted font-mono'

export const cemrrAli = 'grid gap-2.5'

export const cemrrAliValue =
  'text-[38px] font-bold tabular-nums tracking-[-0.04em]'

export const cemrrAliCaption = 'text-[11px] text-muted'

export const cemrrAliBarLabel =
  'text-[11px] text-muted uppercase tracking-[0.06em]'

export const cemrrAliBar =
  'flex h-[18px] rounded-[9px] overflow-hidden shadow-[0_4px_18px_rgb(15_23_42/0.08)]'

export const cemrrAliBarLeft =
  'flex items-center justify-center text-[11px] font-bold tabular-nums bg-blue-500 text-white'

export const cemrrAliBarRight =
  'flex flex-1 items-center justify-center text-[11px] font-bold tabular-nums bg-amber-500 text-gray-800'

export const cemrrAliLegend =
  'flex justify-between text-[11px] text-muted font-mono'

export const cemrrDot =
  'inline-block w-2 h-2 rounded-full align-middle mr-1.5'

export const cemrrDotBlue = 'bg-blue-500'

export const cemrrDotAmber = 'bg-amber-500'

export const cemrrJsi = 'grid gap-2.5'

export const cemrrJsiRow = 'grid gap-1'

export const cemrrJsiHead =
  'flex justify-between items-baseline text-xs text-muted [&_strong]:tabular-nums'

export const cemrrJsiTrack = 'h-[5px] rounded-full bg-slate-200 overflow-hidden'

export const cemrrJsiFill =
  'h-full rounded-full transition-[width] duration-[320ms] ease-out'

export const cemrrJsiCaption = 'text-[10px] text-muted font-mono'

export const cemrrJsiSummary =
  'flex justify-between items-baseline gap-3 mt-1 pt-2 border-t border-panel-border text-xs text-muted flex-wrap [&_strong]:text-text-strong [&_strong]:tabular-nums'

export const cemrrJsiRef = 'text-[10px] font-mono'

export const cemrrRecList = 'grid gap-2.5'

export const cemrrRec =
  'grid grid-cols-[36px_minmax(0,1fr)] gap-3 items-start py-3 px-3.5 rounded-[14px] border-l-[3px] border-solid'

export const cemrrRecHigh = 'bg-red-100/45 border-red-400'

export const cemrrRecMid = 'bg-amber-100/45 border-amber-500'

export const cemrrRecLow = 'bg-emerald-100/45 border-emerald-500'

export const cemrrRecBadge =
  'inline-flex items-center justify-center w-7 h-7 rounded-full bg-white font-bold text-xs text-text-strong'

export const cemrrRecBodyStrong = 'block text-sm text-text-strong'

export const cemrrRecBodyText = 'mt-1 text-muted text-[13px] leading-normal'

export const cemrrHistory = 'min-w-0'

export const cemrrHistoryCharts =
  'grid grid-cols-2 max-[980px]:grid-cols-1 gap-3.5 min-w-0'

export const cemrrHistoryChart =
  'grid gap-1.5 min-w-0 bg-slate-100/40 rounded-2xl p-3'

export const cemrrHistoryChartTitle =
  'text-[11px] text-muted tracking-[0.08em] uppercase'

export const cemrrHistoryChartShell = 'relative w-full h-60 min-w-0'

export const controls = cn(
  container,
  panel,
  'mt-8 rounded-[28px] p-3.5 grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 max-[980px]:grid-cols-1',
)

export const frameMeta =
  'justify-self-end text-right max-[980px]:justify-self-start max-[980px]:text-left text-muted text-xs tracking-[0.08em] uppercase break-words'

export const feetPanel = cn(container, 'mt-6 rounded-[32px] overflow-hidden', panel)

export const feetPanelPair =
  'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] max-[980px]:grid-cols-1 items-stretch'

export const feetPanelSep =
  'w-px bg-panel-border max-[980px]:w-full max-[980px]:h-px'

export const feetPanelSide = 'px-5 py-5 min-w-0'

export const footCard = cn(panel, 'overflow-hidden rounded-[32px]')

export const footCardHead =
  'flex justify-between gap-4 p-6 border-b border-panel-border'

export const footCardTitle = 'm-0 text-text-strong text-[26px] tracking-[-0.04em]'

export const pill = 'self-start rounded-full px-3 py-1.5 text-xs font-bold'

export const pillOk = 'text-emerald-700 bg-emerald-100'

export const pillWarn = 'text-amber-700 bg-amber-100'

export const footCardBody =
  'grid grid-cols-[minmax(0,1fr)_150px] max-[640px]:grid-cols-1 gap-6 items-center p-6'

export const footCardBodyEmbedded =
  'grid-cols-[minmax(0,1fr)_120px] gap-4 max-[980px]:grid-cols-1'

export const footVisual =
  'foot-glow relative w-full max-w-[330px] mx-auto [&_svg]:relative [&_svg]:w-full [&_svg]:overflow-visible [&_svg]:drop-shadow-[0_22px_30px_rgb(15_23_42/0.14)]'

export const metricsGrid = 'grid gap-3 max-[640px]:grid-cols-2'

export const patientFootGrid =
  'grid grid-cols-[minmax(0,0.82fr)_minmax(260px,1fr)] max-[980px]:grid-cols-1 gap-5 items-center overflow-hidden rounded-[32px] p-7 max-[640px]:p-[22px]'

export const patientFootEmbedded = cn(
  feetPanelSide,
  'grid grid-cols-[minmax(0,1fr)_minmax(180px,1fr)] gap-4 items-center p-6 rounded-none shadow-none border-0 bg-transparent max-[980px]:grid-cols-1',
)

export const patientFootWaiting = 'bg-white/74'

export const patientFootLight =
  'bg-gradient-to-br from-cyan-50/82 to-emerald-50/90'

export const patientFootSteady =
  'bg-gradient-to-br from-emerald-50/90 to-yellow-100/74'

export const patientFootStrong =
  'bg-gradient-to-br from-orange-50/92 to-red-100/78'

export const patientFootCopyTitle =
  'max-w-[280px] m-0 text-text-strong text-[clamp(28px,4vw,44px)] leading-[1.05]'

export const patientFootVisual =
  'patient-foot-glow relative w-full max-w-[360px] mx-auto [&_svg]:relative [&_svg]:w-full [&_svg]:overflow-visible [&_svg]:drop-shadow-[0_24px_32px_rgb(15_23_42/0.13)]'

export const liveInactive = cn(
  container,
  'mt-6 grid grid-cols-[auto_minmax(0,1fr)] max-[640px]:grid-cols-1 gap-6 items-center border border-dashed border-panel-border rounded-[28px] px-8 py-7 bg-white/65 shadow-panel backdrop-blur-[18px] text-text-strong',
)

export const liveInactivePatient =
  'px-10 py-12 border-solid bg-gradient-to-br from-white/92 to-emerald-50/86'

export const liveInactiveIcon =
  'inline-flex w-16 h-16 items-center justify-center rounded-full bg-cyan-400/18 text-cyan-700'

export const liveInactiveCopy = 'grid gap-1.5 min-w-0'

export const liveInactiveTitle =
  'm-0 text-text-strong text-2xl tracking-[-0.02em] leading-[1.15]'

export const liveInactiveTitlePatient =
  'text-[clamp(26px,3.5vw,36px)]'

export const liveInactiveText = 'm-0 text-muted text-sm leading-relaxed'

export const garden = cn(container, 'mt-4 grid gap-3')

export const gardenStage =
  'relative w-full aspect-[16/10] rounded-[28px] overflow-hidden border border-panel-border shadow-[0_30px_80px_rgb(15_23_42/0.18)] bg-sky-200'

export const gardenCanvas = 'block w-full h-full'

export const gardenHint = 'm-0 text-center text-muted text-[13px]'

export const gardenFeet =
  'absolute inset-0 pointer-events-none flex justify-center items-end gap-[clamp(12px,4vw,48px)] pb-[4%]'

export const gardenFeetSide =
  'relative w-[16%] max-w-[180px] min-w-[86px] aspect-[100/112] shrink-0 drop-shadow-[0_18px_28px_rgb(15_23_42/0.28)] max-[720px]:w-[14%] [&_svg]:w-full [&_svg]:h-full [&_svg]:overflow-visible'

export const gardenHud =
  'absolute inset-0 p-[22px_26px] max-[720px]:p-3.5 pointer-events-none text-slate-900 grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto_1fr] gap-3.5 max-[720px]:gap-2.5'

export const gardenHudCounter =
  'col-start-2 row-start-1 flex items-center gap-3 pl-[18px] pr-[22px] py-2.5 bg-white/85 rounded-full shadow-[0_18px_40px_rgb(15_23_42/0.18)] backdrop-blur-[10px] max-[720px]:px-4 max-[720px]:gap-2'

export const gardenHudCounterIcon =
  'text-4xl leading-none max-[720px]:text-[28px]'

export const gardenHudCounterValue =
  'text-[clamp(36px,6vw,64px)] leading-none tracking-[-0.04em] tabular-nums text-slate-900'

export const gardenHudCounterLabel =
  'text-[13px] font-semibold text-slate-500 max-w-[120px] leading-tight max-[720px]:hidden'

export const gardenHudStage =
  'col-start-1 row-start-1 grid gap-1.5 self-start px-4 py-2.5 bg-white/85 rounded-2xl shadow-[0_18px_40px_rgb(15_23_42/0.16)] backdrop-blur-[10px] w-fit'

export const gardenHudStageLabel =
  'text-[13px] font-bold text-slate-900 tracking-[0.02em]'

export const gardenHudStageBar =
  'w-40 h-2 rounded-full bg-slate-200 overflow-hidden max-[720px]:w-[110px]'

export const gardenHudStageFill =
  'h-full bg-gradient-to-r from-lime-500 via-green-500 to-green-600 transition-[width] duration-[220ms] ease-out'
