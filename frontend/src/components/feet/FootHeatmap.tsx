import { memo } from 'react'
import type { FootHeatmapProps } from '../../types/components'
import { contrastIntensity, pressureColor } from '../../lib/pressure/color'
import { CONTACT_THRESHOLD_KPA } from '../../constants/insole'


function FootHeatmapInner({ frame, idPrefix, scale, showSensors, silhouette, title }: FootHeatmapProps) {
  const clipId = `${idPrefix}-foot-clip`
  const gradientId = `${idPrefix}-foot-depth`

  return (
    <svg viewBox="0 0 100 112" role="img" aria-label={title}>
      <defs>
        <clipPath id={clipId}>
          <path d={silhouette.path} />
        </clipPath>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(248 250 252)" />
          <stop offset="100%" stopColor="rgb(226 232 240)" />
        </linearGradient>
      </defs>

      <path className="foot-outline" d={silhouette.path} fill={`url(#${gradientId})`} />
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="100" height="102" fill="rgb(248 250 252 / 0.36)" />
        {frame.points.map((point) => {
          const intensity = contrastIntensity(point.pressure / scale)

          return (
            <circle
              key={`${idPrefix}-heat-${point.index}`}
              cx={point.x}
              cy={100 - point.y}
              r={6 + intensity * 14}
              fill={pressureColor(point.pressure, scale)}
              opacity={0.04 + intensity * 0.94}
              style={{ filter: 'blur(4px)' }}
            />
          )
        })}
      </g>

      {showSensors &&
        frame.points.map((point) => {
          const active = point.pressure >= CONTACT_THRESHOLD_KPA
          const intensity = contrastIntensity(point.pressure / scale)

          return (
            <g key={`${idPrefix}-sensor-${point.index}`}>
              <circle
                cx={point.x}
                cy={100 - point.y}
                r={active ? 2.3 + intensity * 1.5 : 1.7}
                fill={active ? pressureColor(point.pressure, scale) : 'rgb(203 213 225)'}
                stroke="rgb(51 65 85 / 0.55)"
                strokeWidth="0.35"
              />
              {intensity > 0.56 && (
                <circle
                  cx={point.x}
                  cy={100 - point.y}
                  r={5.8 + intensity * 2.4}
                  fill="none"
                  stroke={pressureColor(point.pressure, scale)}
                  strokeWidth="0.8"
                  opacity="0.5"
                />
              )}
            </g>
          )
        })}
    </svg>
  )
}

export const FootHeatmap = memo(FootHeatmapInner)
