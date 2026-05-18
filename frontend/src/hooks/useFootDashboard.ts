import { useMemo } from 'react'
import type { FootDashboard, FramePayload, GeometryPayload } from '../types/insole'
import { MAX_KPA } from '../constants/insole'
import { buildSensorGeometry } from '../lib/foot/geometry'
import { buildFootFrame } from '../lib/foot/frames'
import { buildFootSilhouette } from '../lib/foot/silhouette'


export function useFootDashboard(geometry: GeometryPayload | null, frame: FramePayload | null): FootDashboard {
  const leftSensors = useMemo(
    () => (geometry ? buildSensorGeometry(geometry.left, geometry.sensorSideMm) : []),
    [geometry],
  )
  const rightSensors = useMemo(
    () => (geometry ? buildSensorGeometry(geometry.right, geometry.sensorSideMm) : []),
    [geometry],
  )
  const leftSilhouette = useMemo(() => buildFootSilhouette(leftSensors), [leftSensors])
  const rightSilhouette = useMemo(() => buildFootSilhouette(rightSensors), [rightSensors])
  const leftFrame = useMemo(
    () => buildFootFrame(leftSensors, frame?.left, frame?.leftStats, Boolean(frame?.leftOnline)),
    [leftSensors, frame],
  )
  const rightFrame = useMemo(
    () => buildFootFrame(rightSensors, frame?.right, frame?.rightStats, Boolean(frame?.rightOnline)),
    [rightSensors, frame],
  )
  const totalLoad = leftFrame.stats.sumKpa + rightFrame.stats.sumKpa
  const leftShare = totalLoad > 0 ? Math.round((leftFrame.stats.sumKpa / totalLoad) * 100) : 50
  const dynamicScale = Math.max(
    MAX_KPA * 0.25,
    Math.min(Math.max(leftFrame.stats.maxKpa, rightFrame.stats.maxKpa) * 1.3, MAX_KPA),
  )

  return {
    dynamicScale,
    leftFrame,
    leftShare,
    leftSilhouette,
    rightFrame,
    rightSilhouette,
  }
}
