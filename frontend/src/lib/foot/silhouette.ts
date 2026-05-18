import type { SensorPoint, FootSilhouette, PathPoint } from '../../types/insole'
import { FALLBACK_FOOT_PATH } from '../../constants/pressure'
import { FOOT_CONTOUR_CORNER_RADIUS, FOOT_CONTOUR_DIP_FILL } from '../../constants/foot'
import { clamp } from '../math'


export function buildFootSilhouette(points: SensorPoint[]): FootSilhouette {
  if (points.length < 3) {
    return { path: FALLBACK_FOOT_PATH, edgeIndexes: [] }
  }

  const rows = new Map<string, SensorPoint[]>()
  for (const point of points) {
    const key = point.yMm.toFixed(3)
    rows.set(key, [...(rows.get(key) ?? []), point])
  }

  const edgePadding = 3.9
  const sections = [...rows.values()]
    .map((row) => {
      const leftEdge = row.reduce((best, point) => (point.x < best.x ? point : best), row[0])
      const rightEdge = row.reduce((best, point) => (point.x > best.x ? point : best), row[0])

      return {
        y: 100 - row[0].y,
        leftX: leftEdge.x - edgePadding,
        rightX: rightEdge.x + edgePadding,
        leftIndex: leftEdge.index,
        rightIndex: rightEdge.index,
      }
    })
    .sort((a, b) => a.y - b.y)

  sections[0] = { ...sections[0], y: sections[0].y - edgePadding }
  sections[sections.length - 1] = { ...sections[sections.length - 1], y: sections[sections.length - 1].y + edgePadding }

  const rightSide = sections.map(({ rightX, y }) => ({ x: rightX, y }))
  const leftSide = [...sections].reverse().map(({ leftX, y }) => ({ x: leftX, y }))
  const edgeIndexes = [...new Set(sections.flatMap((section) => [section.leftIndex, section.rightIndex]))]
  const outline = [...rightSide, ...leftSide].map((point) => ({
    x: clamp(point.x, 3, 97),
    y: clamp(point.y, 2, 108),
  }))
  const softened = softenConcaveDips(
    softenConcaveDips(outline, FOOT_CONTOUR_DIP_FILL),
    FOOT_CONTOUR_DIP_FILL * 0.65,
  )

  return { path: closedRoundedPath(softened, FOOT_CONTOUR_CORNER_RADIUS), edgeIndexes }
}

export function closedRoundedPath(points: PathPoint[], radius: number) {
  const corners = points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length]
    const next = points[(index + 1) % points.length]

    return {
      point,
      before: pointToward(point, previous, radius),
      after: pointToward(point, next, radius),
    }
  })
  const [first, ...rest] = corners
  const segments = rest.map(
    (corner) =>
      `L ${corner.before.x.toFixed(2)} ${corner.before.y.toFixed(2)} Q ${corner.point.x.toFixed(2)} ${corner.point.y.toFixed(2)} ${corner.after.x.toFixed(2)} ${corner.after.y.toFixed(2)}`,
  )

  return `M ${first.after.x.toFixed(2)} ${first.after.y.toFixed(2)} ${segments.join(' ')} L ${first.before.x.toFixed(2)} ${first.before.y.toFixed(2)} Q ${first.point.x.toFixed(2)} ${first.point.y.toFixed(2)} ${first.after.x.toFixed(2)} ${first.after.y.toFixed(2)} Z`
}

export function softenConcaveDips(points: PathPoint[], dipFill: number) {
  const strength = clamp(dipFill / 100, 0, 4)

  if (strength <= 0 || points.length < 3) {
    return points
  }

  return points.map((curr, index) => {
    const prev = points[(index - 1 + points.length) % points.length]
    const next = points[(index + 1) % points.length]

    if (!isConcaveVertex(prev, curr, next)) {
      return curr
    }

    const depth = concavityDepth(prev, curr, next)
    const localStrength = Math.min(1, strength * clamp(depth / 6, 0.35, 1))
    const ax = next.x - prev.x
    const ay = next.y - prev.y
    const len2 = ax * ax + ay * ay
    const t = clamp(((curr.x - prev.x) * ax + (curr.y - prev.y) * ay) / len2, 0, 1)
    const projX = prev.x + t * ax
    const projY = prev.y + t * ay

    return {
      x: curr.x + (projX - curr.x) * localStrength,
      y: curr.y + (projY - curr.y) * localStrength,
    }
  })
}

export function isConcaveVertex(prev: PathPoint, curr: PathPoint, next: PathPoint) {
  const ax = curr.x - prev.x
  const ay = curr.y - prev.y
  const bx = next.x - curr.x
  const by = next.y - curr.y

  return ax * by - ay * bx < 0
}

export function concavityDepth(prev: PathPoint, curr: PathPoint, next: PathPoint) {
  const ax = next.x - prev.x
  const ay = next.y - prev.y
  const len2 = ax * ax + ay * ay

  if (len2 < 1e-6) {
    return 0
  }

  const t = clamp(((curr.x - prev.x) * ax + (curr.y - prev.y) * ay) / len2, 0, 1)
  const projX = prev.x + t * ax
  const projY = prev.y + t * ay

  return Math.hypot(curr.x - projX, curr.y - projY)
}

export function pointToward(from: PathPoint, to: PathPoint, distance: number) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const amount = Math.min(distance, length / 2) / length

  return { x: from.x + dx * amount, y: from.y + dy * amount }
}
