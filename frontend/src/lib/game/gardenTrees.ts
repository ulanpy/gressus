import { stageFromCharge } from './garden'
import type { TreeKind } from '../../types/garden'

export const TREE_SLOT_X = [0.22, 0.5, 0.78] as const

export function treeCenterX(w: number, slotIndex: number): number {
  return w * TREE_SLOT_X[slotIndex]
}

export function drawGardenTree(
  ctx: CanvasRenderingContext2D,
  kind: TreeKind,
  cx: number,
  groundY: number,
  w: number,
  h: number,
  growth: number,
  charge: number,
  now: number,
) {
  const treeScale = 0.72

  if (growth < 0.05) {
    drawSeed(ctx, cx, groundY, growth)
    return
  }

  const trunkMaxH = h * 0.28 * treeScale
  const trunkH = Math.max(h * 0.015, trunkMaxH * growth)
  const trunkW = (5 + growth * 18) * treeScale
  const sway = Math.sin(now * 0.0015 + cx * 0.01) * growth * 3
  const trunkTopY = groundY - trunkH

  if (kind === 'birch') {
    drawBirchTrunk(ctx, cx, groundY, trunkTopY, trunkW, trunkH, sway)
  } else {
    drawBrownTrunk(ctx, cx, groundY, trunkTopY, trunkW, trunkH, sway, kind)
  }

  if (growth > 0.28) {
    if (kind === 'apple') drawAppleCrown(ctx, cx + sway, trunkTopY, w, h, growth, charge, now, treeScale)
    else if (kind === 'sakura') drawSakuraCrown(ctx, cx + sway, trunkTopY, w, h, growth, charge, now, treeScale)
    else drawBirchCrown(ctx, cx + sway, trunkTopY, w, h, growth, charge, now, treeScale)
  }
}

function drawSeed(ctx: CanvasRenderingContext2D, cx: number, groundY: number, growth: number) {
  const size = 5 + growth * 6
  ctx.save()
  ctx.fillStyle = 'rgb(146 64 14)'
  ctx.beginPath()
  ctx.ellipse(cx, groundY - size * 0.35, size, size * 0.55, 0, 0, Math.PI * 2)
  ctx.fill()
  if (growth > 0.02) {
    ctx.strokeStyle = 'rgb(34 197 94)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(cx, groundY - size * 0.5)
    ctx.lineTo(cx, groundY - size - growth * 14)
    ctx.stroke()
  }
  ctx.restore()
}

function drawBrownTrunk(
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  trunkTopY: number,
  trunkW: number,
  _trunkH: number,
  sway: number,
  kind: TreeKind,
) {
  const grad = ctx.createLinearGradient(cx - trunkW, trunkTopY, cx + trunkW, groundY)
  grad.addColorStop(0, kind === 'sakura' ? 'rgb(100 60 40)' : 'rgb(120 53 15)')
  grad.addColorStop(1, kind === 'sakura' ? 'rgb(140 80 50)' : 'rgb(180 83 9)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(cx - trunkW * 0.55, groundY)
  ctx.quadraticCurveTo(cx - trunkW * 0.75 + sway, (groundY + trunkTopY) / 2, cx - trunkW * 0.32 + sway, trunkTopY)
  ctx.lineTo(cx + trunkW * 0.32 + sway, trunkTopY)
  ctx.quadraticCurveTo(cx + trunkW * 0.75 + sway, (groundY + trunkTopY) / 2, cx + trunkW * 0.55, groundY)
  ctx.closePath()
  ctx.fill()
}

function drawBirchTrunk(
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  trunkTopY: number,
  trunkW: number,
  _trunkH: number,
  sway: number,
) {
  ctx.save()
  ctx.fillStyle = 'rgb(248 250 252)'
  ctx.strokeStyle = 'rgb(203 213 225)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx - trunkW * 0.35 + sway, groundY)
  ctx.lineTo(cx - trunkW * 0.22 + sway, trunkTopY)
  ctx.lineTo(cx + trunkW * 0.22 + sway, trunkTopY)
  ctx.lineTo(cx + trunkW * 0.35 + sway, groundY)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = 'rgb(148 163 184 / 0.5)'
  for (let y = trunkTopY + 8; y < groundY - 4; y += 14) {
    ctx.beginPath()
    ctx.moveTo(cx - trunkW * 0.15 + sway, y)
    ctx.lineTo(cx + trunkW * 0.15 + sway, y + 3)
    ctx.stroke()
  }
  ctx.restore()
}

function drawAppleCrown(
  ctx: CanvasRenderingContext2D,
  cx: number,
  trunkTopY: number,
  w: number,
  h: number,
  growth: number,
  charge: number,
  now: number,
  treeScale: number,
) {
  const crownR = Math.min(w, h) * 0.14 * treeScale * Math.min(1, (growth - 0.25) / 0.55)
  const crownCY = trunkTopY - crownR * 0.4
  drawGreenLobes(ctx, cx, crownCY, crownR)

  const stage = stageFromCharge(charge)
  if (stage.stage >= 4) drawPinkDots(ctx, cx, crownCY, crownR, now, 7, 'rgb(251 207 232)')
  if (stage.stage >= 5) {
    const n = Math.max(2, Math.round(stage.progress * 5 + 2))
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + 0.3
      const r = crownR * (0.5 + Math.cos(now * 0.001 + i) * 0.06)
      drawAppleFruit(ctx, cx + Math.cos(angle) * r, crownCY + Math.sin(angle) * r * 0.75, crownR * 0.11)
    }
  }
}

function drawSakuraCrown(
  ctx: CanvasRenderingContext2D,
  cx: number,
  trunkTopY: number,
  w: number,
  h: number,
  growth: number,
  charge: number,
  now: number,
  treeScale: number,
) {
  const crownR = Math.min(w, h) * 0.13 * treeScale * Math.min(1, (growth - 0.25) / 0.55)
  const crownCY = trunkTopY - crownR * 0.38

  ctx.save()
  for (const lobe of sakuraLobes(cx, crownCY, crownR)) {
    const grad = ctx.createRadialGradient(lobe.x, lobe.y, lobe.r * 0.1, lobe.x, lobe.y, lobe.r)
    grad.addColorStop(0, 'rgb(253 186 216)')
    grad.addColorStop(0.6, 'rgb(244 114 182)')
    grad.addColorStop(1, 'rgb(190 24 93 / 0.85)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(lobe.x, lobe.y, lobe.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  const stage = stageFromCharge(charge)
  if (stage.stage >= 4) drawPinkDots(ctx, cx, crownCY, crownR, now, 10, 'rgb(255 255 255 / 0.9)')
  if (stage.stage >= 5) {
    const n = Math.max(2, Math.round(stage.progress * 6 + 2))
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2
      const r = crownR * 0.58
      drawCherry(ctx, cx + Math.cos(angle) * r, crownCY + Math.sin(angle) * r * 0.7, crownR * 0.09)
    }
  }
}

function drawBirchCrown(
  ctx: CanvasRenderingContext2D,
  cx: number,
  trunkTopY: number,
  w: number,
  h: number,
  growth: number,
  charge: number,
  now: number,
  treeScale: number,
) {
  const crownR = Math.min(w, h) * 0.12 * treeScale * Math.min(1, (growth - 0.25) / 0.55)
  const crownCY = trunkTopY - crownR * 0.35

  drawGreenLobes(ctx, cx, crownCY, crownR, 'rgb(187 247 208)', 'rgb(34 197 94)')

  const stage = stageFromCharge(charge)
  if (stage.stage >= 4) {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + now * 0.002
      const r = crownR * (0.65 + Math.sin(i) * 0.1)
      drawLeaf(ctx, cx + Math.cos(angle) * r, crownCY + Math.sin(angle) * r * 0.65, crownR * 0.07, angle)
    }
  }
  if (stage.stage >= 5) {
    const n = Math.max(3, Math.round(stage.progress * 8 + 3))
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + 0.5
      const r = crownR * 0.55
      drawLeaf(ctx, cx + Math.cos(angle) * r, crownCY + Math.sin(angle) * r * 0.6, crownR * 0.08, angle + i)
    }
  }
}

function sakuraLobes(cx: number, cy: number, r: number) {
  return [
    { x: cx, y: cy, r },
    { x: cx - r * 0.65, y: cy + r * 0.15, r: r * 0.75 },
    { x: cx + r * 0.68, y: cy + r * 0.1, r: r * 0.78 },
    { x: cx - r * 0.25, y: cy - r * 0.5, r: r * 0.65 },
    { x: cx + r * 0.3, y: cy - r * 0.55, r: r * 0.62 },
  ]
}

function drawGreenLobes(
  ctx: CanvasRenderingContext2D,
  cx: number,
  crownCY: number,
  crownR: number,
  inner = 'rgb(132 204 22)',
  outer = 'rgb(34 139 34)',
) {
  const lobes = [
    { dx: 0, dy: 0, r: crownR },
    { dx: -crownR * 0.65, dy: crownR * 0.18, r: crownR * 0.75 },
    { dx: crownR * 0.68, dy: crownR * 0.12, r: crownR * 0.78 },
    { dx: -crownR * 0.28, dy: -crownR * 0.5, r: crownR * 0.68 },
    { dx: crownR * 0.32, dy: -crownR * 0.55, r: crownR * 0.64 },
  ]
  ctx.save()
  for (const lobe of lobes) {
    const grad = ctx.createRadialGradient(
      cx + lobe.dx,
      crownCY + lobe.dy,
      lobe.r * 0.12,
      cx + lobe.dx,
      crownCY + lobe.dy,
      lobe.r,
    )
    grad.addColorStop(0, inner)
    grad.addColorStop(1, outer)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx + lobe.dx, crownCY + lobe.dy, lobe.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawPinkDots(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  crownR: number,
  now: number,
  count: number,
  color: string,
) {
  ctx.save()
  ctx.fillStyle = color
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    const r = crownR * (0.72 + Math.sin(now * 0.003 + i) * 0.04)
    ctx.beginPath()
    ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r * 0.75, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function drawAppleFruit(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rot = 0) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  const grad = ctx.createRadialGradient(-size * 0.3, -size * 0.3, size * 0.1, 0, 0, size)
  grad.addColorStop(0, 'rgb(254 226 226)')
  grad.addColorStop(0.45, 'rgb(248 113 113)')
  grad.addColorStop(1, 'rgb(185 28 28)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(0, 0, size, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawCherry(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save()
  ctx.fillStyle = 'rgb(220 38 38)'
  ctx.beginPath()
  ctx.arc(x - size * 0.35, y, size * 0.85, 0, Math.PI * 2)
  ctx.arc(x + size * 0.35, y, size * 0.85, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgb(34 197 94)'
  ctx.fillRect(x - 1, y - size * 1.8, 2, size * 0.6)
  ctx.restore()
}

export function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.fillStyle = 'rgb(134 239 172)'
  ctx.strokeStyle = 'rgb(22 163 74)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.ellipse(0, 0, size, size * 0.45, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.4)
  ctx.lineTo(0, size * 0.35)
  ctx.stroke()
  ctx.restore()
}
