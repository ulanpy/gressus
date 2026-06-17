import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n/context'
import {
  GARDEN_CONFIG,
  GARDEN_TREE_ORDER,
  balanceFrom,
  chargeFromQuality,
  createStepDetectorState,
  isFullyGrown,
  manualEmit,
  pushBalanceSample,
  qualityFromSymmetry,
  stageFromCharge,
} from '../../lib/game/garden'
import {
  drawAppleFruit,
  drawCherry,
  drawGardenTree,
  drawLeaf,
  treeCenterX,
} from '../../lib/game/gardenTrees'
import type {
  GardenHud,
  HarvestKind,
  StepEmit,
  StepQuality,
  TreeKind,
  TreeStage,
} from '../../types/garden'
import type { FootDashboard, FramePayload } from '../../types/insole'
import {
  garden,
  gardenCanvas,
  gardenFeet,
  gardenFeetSide,
  gardenHint,
  gardenHud,
  gardenHudCounter,
  gardenHudCounterIcon,
  gardenHudCounterLabel,
  gardenHudCounterValue,
  gardenHudStage,
  gardenHudStageBar,
  gardenHudStageFill,
  gardenHudStageLabel,
  gardenStage,
} from '../../styles/ui'
import { FootHeatmap } from '../feet/FootHeatmap'

const CYCLES_STORAGE_KEY = 'tfg.garden.cycles'

type StarParticle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  glow: string
  size: number
  rot: number
  rotSpeed: number
}

type HarvestItem = {
  kind: HarvestKind
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  rotSpeed: number
  size: number
  bornAt: number
}

type TreeSlot = {
  charge: number
  visibleGrowth: number
  targetGrowth: number
}

type GardenState = {
  trees: [TreeSlot, TreeSlot, TreeSlot]
  activeIndex: 0 | 1 | 2
  isHarvesting: boolean
  harvestStartedAt: number
  harvestItems: HarvestItem[]
  stars: StarParticle[]
  balance: number
  stepCount: number
  symmetrySum: number
  lastQuality: StepQuality | null
  recentChargePerStep: number
}

/** Stars per step quality: count, size range, scatter arc (radians), burst speed. */
const QUALITY_STARS: Record<
  StepQuality,
  { count: number; sizeMin: number; sizeMax: number; spread: number; speed: number }
> = {
  great: { count: 20, sizeMin: 7, sizeMax: 13, spread: 1.35, speed: 1.55 },
  good: { count: 11, sizeMin: 5, sizeMax: 8, spread: 0.85, speed: 1.1 },
  ok: { count: 5, sizeMin: 3.5, sizeMax: 5.5, spread: 0.45, speed: 0.75 },
  weak: { count: 2, sizeMin: 2, sizeMax: 3.5, spread: 0.2, speed: 0.45 },
}

const STAR_FILL: Record<StepQuality, string> = {
  great: 'rgb(254 240 138)',
  good: 'rgb(253 224 71)',
  ok: 'rgb(191 219 254)',
  weak: 'rgb(226 232 240)',
}

const STAR_GLOW: Record<StepQuality, string> = {
  great: 'rgb(250 204 21)',
  good: 'rgb(234 179 8)',
  ok: 'rgb(148 163 184)',
  weak: 'rgb(148 163 184 / 0.5)',
}

const MAX_CHARGE = GARDEN_CONFIG.stageThresholds[GARDEN_CONFIG.stageThresholds.length - 1]

function emptySlot(): TreeSlot {
  return { charge: 0, visibleGrowth: 0, targetGrowth: 0 }
}

function readCyclesCount(): number {
  if (typeof window === 'undefined') return 0
  const raw =
    window.localStorage.getItem(CYCLES_STORAGE_KEY) ??
    window.localStorage.getItem('tfg.garden.trees')
  if (!raw) return 0
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function writeCyclesCount(value: number) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CYCLES_STORAGE_KEY, String(Math.round(value)))
  } catch {
    /* storage unavailable */
  }
}

function createInitialGarden(): GardenState {
  return {
    trees: [emptySlot(), emptySlot(), emptySlot()],
    activeIndex: 0,
    isHarvesting: false,
    harvestStartedAt: 0,
    harvestItems: [],
    stars: [],
    balance: 0,
    stepCount: 0,
    symmetrySum: 0,
    lastQuality: null,
    recentChargePerStep: 0,
  }
}

function slotDisplayGrowth(
  garden: GardenState,
  index: number,
  now: number,
): number {
  const slot = garden.trees[index]
  if (garden.isHarvesting) {
    const fade = Math.max(
      0,
      1 - (now - garden.harvestStartedAt) / GARDEN_CONFIG.harvestDurationMs,
    )
    return slot.visibleGrowth * fade
  }
  if (index < garden.activeIndex) return 1
  if (index > garden.activeIndex) return Math.min(slot.visibleGrowth, 0.08)
  return slot.visibleGrowth
}

function growthFromCharge(charge: number): number {
  return Math.min(1, charge / MAX_CHARGE)
}

type AppleTreeGardenProps = {
  frame: FramePayload | null
  dashboard: FootDashboard
}

export function AppleTreeGarden({ frame, dashboard }: AppleTreeGardenProps) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const gardenRef = useRef<GardenState>(createInitialGarden())
  const detectorRef = useRef(createStepDetectorState())
  const rafRef = useRef<number>(0)
  const lastTickRef = useRef<number>(0)
  const dprRef = useRef<number>(1)
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })
  const lastSeqRef = useRef<number | string | null>(null)
  const initialCyclesRef = useRef<number>(readCyclesCount())

  const [hud, setHud] = useState<GardenHud>(() => ({
    cyclesGrown: initialCyclesRef.current,
    activeTree: 'apple',
    stage: 0,
    stageProgress: 0,
    stepCount: 0,
    meanSymmetry: 0,
    lastQuality: null,
    recentChargePerStep: 0,
  }))

  const spawnStars = useCallback(
    (
      canvasSize: { width: number; height: number },
      quality: StepQuality,
      symmetry: number,
      side: 'left' | 'right',
    ) => {
      const garden = gardenRef.current
      const cfg = QUALITY_STARS[quality]
      if (cfg.count === 0) return

      const symmetryScale = quality === 'weak' ? 1 : 0.55 + symmetry * 0.45
      const count = Math.max(
        quality === 'weak' ? 1 : 2,
        Math.round(cfg.count * symmetryScale),
      )

      const startX = side === 'left' ? canvasSize.width * 0.42 : canvasSize.width * 0.58
      const startY = canvasSize.height * 0.82
      const treeX = treeCenterX(canvasSize.width, gardenRef.current.activeIndex)
      const treeY = canvasSize.height * 0.45
      const towardTree = Math.atan2(treeY - startY, treeX - startX)

      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) - 0.5 : 0
        const angle = towardTree + t * cfg.spread + (Math.random() - 0.5) * cfg.spread * 0.35
        const speed = cfg.speed * (90 + Math.random() * 140)
        const life = 1.0 + Math.random() * 0.55
        const size =
          cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin) * (0.7 + symmetry * 0.3)

        garden.stars.push({
          x: startX + (Math.random() - 0.5) * 20,
          y: startY + (Math.random() - 0.5) * 10,
          vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 35,
          vy: Math.sin(angle) * speed + (Math.random() - 0.5) * 25,
          life,
          maxLife: life,
          color: STAR_FILL[quality],
          glow: STAR_GLOW[quality],
          size,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 8,
        })
      }
    },
    [],
  )

  const triggerHarvest = useCallback((now: number, canvasSize: { width: number; height: number }) => {
    const garden = gardenRef.current
    garden.isHarvesting = true
    garden.harvestStartedAt = now
    const groundY = canvasSize.height * 0.78
    const cy = groundY - canvasSize.height * 0.22

    const spawn = (slotIndex: number, kind: HarvestKind, count: number, sizeBase: number) => {
      const cx = treeCenterX(canvasSize.width, slotIndex)
      const radius = canvasSize.width * 0.07
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6
        const dist = radius * (0.35 + Math.random() * 0.75)
        garden.harvestItems.push({
          kind,
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist * 0.65,
          vx: (Math.random() - 0.5) * (kind === 'leaf' ? 90 : 110),
          vy: -30 - Math.random() * (kind === 'leaf' ? 50 : 75),
          rot: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * (kind === 'leaf' ? 4 : 6),
          size: sizeBase + Math.random() * (kind === 'leaf' ? 3 : 4),
          bornAt: now,
        })
      }
    }

    spawn(0, 'apple', 8, canvasSize.width * 0.02)
    spawn(1, 'cherry', 9, canvasSize.width * 0.016)
    spawn(2, 'leaf', 14, canvasSize.width * 0.014)
  }, [])

  const finishHarvest = useCallback(() => {
    const garden = gardenRef.current
    garden.isHarvesting = false
    garden.harvestItems = []
    garden.trees = [emptySlot(), emptySlot(), emptySlot()]
    garden.activeIndex = 0
    initialCyclesRef.current += 1
    writeCyclesCount(initialCyclesRef.current)
    setHud((prev) => ({
      ...prev,
      cyclesGrown: initialCyclesRef.current,
      activeTree: 'apple',
      stage: 0,
      stageProgress: 0,
    }))
  }, [])

  const applyStep = useCallback(
    (emit: StepEmit, now: number) => {
      const garden = gardenRef.current
      if (garden.isHarvesting) return
      const quality = qualityFromSymmetry(emit.symmetry)
      const charge = chargeFromQuality(quality)
      const canvasSize = sizeRef.current
      if (canvasSize.width === 0) return

      const slot = garden.trees[garden.activeIndex]
      slot.charge = Math.min(MAX_CHARGE, slot.charge + charge)
      slot.targetGrowth = growthFromCharge(slot.charge)
      garden.stepCount += 1
      garden.symmetrySum += emit.symmetry
      garden.lastQuality = quality
      garden.recentChargePerStep = charge

      spawnStars(canvasSize, quality, emit.symmetry, emit.side)

      const { stage, progress } = stageFromCharge(slot.charge)
      const activeTree = GARDEN_TREE_ORDER[garden.activeIndex]
      const stepCount = garden.stepCount
      const meanSym = stepCount > 0 ? garden.symmetrySum / stepCount : 0
      setHud((prev) => ({
        ...prev,
        activeTree,
        stage,
        stageProgress: progress,
        stepCount,
        meanSymmetry: meanSym,
        lastQuality: quality,
        recentChargePerStep: charge,
      }))

      if (isFullyGrown(slot.charge) && !garden.isHarvesting) {
        slot.charge = MAX_CHARGE
        slot.targetGrowth = 1
        slot.visibleGrowth = 1
        if (garden.activeIndex < 2) {
          garden.activeIndex = (garden.activeIndex + 1) as 0 | 1 | 2
          const nextTree = GARDEN_TREE_ORDER[garden.activeIndex]
          const nextSlot = garden.trees[garden.activeIndex]
          setHud((prev) => ({
            ...prev,
            activeTree: nextTree,
            stage: stageFromCharge(nextSlot.charge).stage,
            stageProgress: stageFromCharge(nextSlot.charge).progress,
          }))
        } else {
          for (const t of garden.trees) {
            t.charge = MAX_CHARGE
            t.targetGrowth = 1
          }
          triggerHarvest(now, canvasSize)
        }
      }
    },
    [spawnStars, triggerHarvest],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    dprRef.current = dpr

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.contentRect
        const cssWidth = Math.max(320, rect.width)
        const cssHeight = Math.max(360, rect.height)
        canvas.width = Math.round(cssWidth * dpr)
        canvas.height = Math.round(cssHeight * dpr)
        canvas.style.width = `${cssWidth}px`
        canvas.style.height = `${cssHeight}px`
        sizeRef.current = { width: cssWidth, height: cssHeight }
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!frame) return
    const seq = frame.seq
    if (seq !== null && seq === lastSeqRef.current) return
    lastSeqRef.current = seq
    const leftSum = frame.leftStats?.sumKpa ?? 0
    const rightSum = frame.rightStats?.sumKpa ?? 0
    gardenRef.current.balance = balanceFrom(leftSum, rightSum)
    const emit = pushBalanceSample(detectorRef.current, performance.now(), leftSum, rightSum)
    if (emit) applyStep(emit, performance.now())
  }, [frame, applyStep])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      if (event.repeat) return
      event.preventDefault()
      const emit = manualEmit(detectorRef.current, performance.now())
      applyStep(emit, performance.now())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [applyStep])

  useEffect(() => {
    const tick = (now: number) => {
      const dt = lastTickRef.current === 0 ? 0 : Math.min(0.05, (now - lastTickRef.current) / 1000)
      lastTickRef.current = now

      const garden = gardenRef.current
      const size = sizeRef.current
      const canvas = canvasRef.current
      if (!canvas || size.width === 0) {
        rafRef.current = window.requestAnimationFrame(tick)
        return
      }

      for (const tree of garden.trees) {
        tree.visibleGrowth += (tree.targetGrowth - tree.visibleGrowth) * Math.min(1, dt * 4)
        if (tree.visibleGrowth < tree.targetGrowth - 0.001) {
          tree.visibleGrowth = Math.min(tree.targetGrowth, tree.visibleGrowth + dt * 0.15)
        }
      }
      updateStars(garden, dt)
      updateHarvest(garden, dt, now, size, finishHarvest)

      drawGarden(canvas, garden, size, now, dprRef.current)

      rafRef.current = window.requestAnimationFrame(tick)
    }
    rafRef.current = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(rafRef.current)
  }, [finishHarvest])

  return (
    <section className={garden} aria-label={t.garden.aria}>
      <div ref={containerRef} className={gardenStage}>
        <canvas ref={canvasRef} className={gardenCanvas} />

        <div className={gardenFeet} aria-hidden>
          <div className={gardenFeetSide}>
            <FootHeatmap
              frame={dashboard.leftFrame}
              idPrefix="garden-left"
              outlineClass="garden-foot-outline"
              scale={dashboard.dynamicScale}
              showSensors={false}
              silhouette={dashboard.leftSilhouette}
              title=""
            />
          </div>
          <div className={gardenFeetSide}>
            <FootHeatmap
              frame={dashboard.rightFrame}
              idPrefix="garden-right"
              outlineClass="garden-foot-outline"
              scale={dashboard.dynamicScale}
              showSensors={false}
              silhouette={dashboard.rightSilhouette}
              title=""
            />
          </div>
        </div>

        <GardenOverlay hud={hud} />
      </div>
      <p className={gardenHint}>{t.garden.hint}</p>
    </section>
  )
}

function updateStars(garden: GardenState, dt: number) {
  if (garden.stars.length === 0) return
  for (const star of garden.stars) {
    star.x += star.vx * dt
    star.y += star.vy * dt
    star.vy += 28 * dt
    star.vx *= 1 - dt * 0.4
    star.rot += star.rotSpeed * dt
    star.life -= dt
  }
  garden.stars = garden.stars.filter((s) => s.life > 0)
}

function updateHarvest(
  garden: GardenState,
  dt: number,
  now: number,
  size: { width: number; height: number },
  onDone: () => void,
) {
  if (!garden.isHarvesting) return
  const gravity = size.height * 1.2
  for (const item of garden.harvestItems) {
    item.vy += gravity * dt
    item.x += item.vx * dt
    item.y += item.vy * dt
    item.rot += item.rotSpeed * dt
  }
  if (now - garden.harvestStartedAt >= GARDEN_CONFIG.harvestDurationMs) {
    onDone()
  }
}

function drawGarden(
  canvas: HTMLCanvasElement,
  garden: GardenState,
  size: { width: number; height: number },
  now: number,
  dpr: number,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const w = size.width
  const h = size.height
  drawSky(ctx, w, h)
  drawSun(ctx, w, h, now)
  drawGround(ctx, w, h)
  drawAllTrees(ctx, garden, w, h, now)
  drawHarvestItems(ctx, garden, now)
  drawStars(ctx, garden)
}

function drawAllTrees(
  ctx: CanvasRenderingContext2D,
  garden: GardenState,
  w: number,
  h: number,
  now: number,
) {
  const groundY = h * 0.78
  GARDEN_TREE_ORDER.forEach((kind, index) => {
    const slot = garden.trees[index]
    const growth = slotDisplayGrowth(garden, index, now)
    const charge = index < garden.activeIndex ? MAX_CHARGE : slot.charge
    drawGardenTree(ctx, kind, treeCenterX(w, index), groundY, w, h, growth, charge, now)
  })
}

function drawHarvestItems(ctx: CanvasRenderingContext2D, garden: GardenState, now: number) {
  if (garden.harvestItems.length === 0) return
  for (const item of garden.harvestItems) {
    const ageSec = Math.max(0, (now - item.bornAt) / 1000)
    const alpha = Math.max(0, 1 - ageSec / (GARDEN_CONFIG.harvestDurationMs / 1000))
    ctx.save()
    ctx.globalAlpha = alpha
    if (item.kind === 'apple') drawAppleFruit(ctx, item.x, item.y, item.size, item.rot)
    else if (item.kind === 'cherry') drawCherry(ctx, item.x, item.y, item.size)
    else drawLeaf(ctx, item.x, item.y, item.size, item.rot)
    ctx.restore()
  }
}

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, 'rgb(135 206 250)')
  grad.addColorStop(0.6, 'rgb(186 230 253)')
  grad.addColorStop(1, 'rgb(221 244 255)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
}

function drawSun(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
  const cx = w * 0.85
  const cy = h * 0.18
  const r = Math.min(w, h) * 0.06
  const pulse = 1 + 0.05 * Math.sin(now * 0.002)
  ctx.save()
  ctx.shadowColor = 'rgb(254 240 138 / 0.7)'
  ctx.shadowBlur = 40 * pulse
  ctx.fillStyle = 'rgb(253 224 71)'
  ctx.beginPath()
  ctx.arc(cx, cy, r * pulse, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawGround(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const groundY = h * 0.78
  const grad = ctx.createLinearGradient(0, groundY, 0, h)
  grad.addColorStop(0, 'rgb(74 222 128)')
  grad.addColorStop(1, 'rgb(22 163 74)')
  ctx.fillStyle = grad
  ctx.fillRect(0, groundY, w, h - groundY)

  ctx.fillStyle = 'rgb(34 197 94 / 0.35)'
  for (let i = 0; i < w; i += 22) {
    const x = i + (i % 44 === 0 ? 0 : 11)
    ctx.beginPath()
    ctx.moveTo(x, groundY - 2)
    ctx.lineTo(x - 4, groundY + 6)
    ctx.lineTo(x + 4, groundY + 6)
    ctx.closePath()
    ctx.fill()
  }
}

function drawStars(ctx: CanvasRenderingContext2D, garden: GardenState) {
  if (garden.stars.length === 0) return
  for (const star of garden.stars) {
    const t = star.life / star.maxLife
    const alpha = Math.min(1, t * 1.2)
    const twinkle = 0.85 + 0.15 * Math.sin(star.rot * 3)
    const outer = star.size * twinkle
    const inner = outer * 0.42

    ctx.save()
    ctx.translate(star.x, star.y)
    ctx.rotate(star.rot)
    ctx.globalAlpha = alpha

    ctx.shadowColor = star.glow
    ctx.shadowBlur = outer * 2.2
    ctx.fillStyle = star.color
    drawStarPath(ctx, 0, 0, outer, inner, 5)
    ctx.fill()

    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgb(255 255 255 / 0.9)'
    drawStarPath(ctx, 0, 0, outer * 0.35, inner * 0.35, 5)
    ctx.fill()

    ctx.restore()
  }
}

function drawStarPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  spikes: number,
) {
  ctx.beginPath()
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const angle = (i * Math.PI) / spikes - Math.PI / 2
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

type OverlayProps = {
  hud: GardenHud
}

function GardenOverlay({ hud }: OverlayProps) {
  const { t } = useI18n()
  const stageProgressPercent = Math.round(hud.stageProgress * 100)
  const stageLabel = stageLabelFor(hud.activeTree, hud.stage, t)

  return (
    <div className={gardenHud}>
      <div className={gardenHudCounter} aria-live="polite">
        <span className={gardenHudCounterIcon} aria-hidden>
          🌳
        </span>
        <strong className={gardenHudCounterValue}>{hud.cyclesGrown}</strong>
        <span className={gardenHudCounterLabel}>{t.garden.cyclesGrown}</span>
      </div>

      <div className={gardenHudStage}>
        <span className={gardenHudStageLabel}>{stageLabel}</span>
        <div className={gardenHudStageBar}>
          <div
            className={gardenHudStageFill}
            style={{ width: `${stageProgressPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function stageLabelFor(
  kind: TreeKind,
  stage: TreeStage,
  t: ReturnType<typeof useI18n>['t'],
): string {
  if (stage === 5) {
    if (kind === 'apple') return t.garden.stage.fruitingApple
    if (kind === 'sakura') return t.garden.stage.fruitingSakura
    return t.garden.stage.fruitingBirch
  }
  switch (stage) {
    case 0:
      return t.garden.stage.seed
    case 1:
      return t.garden.stage.sprout
    case 2:
      return t.garden.stage.sapling
    case 3:
      return t.garden.stage.tree
    case 4:
      return t.garden.stage.blossom
    default:
      return ''
  }
}
