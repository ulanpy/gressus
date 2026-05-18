import { useI18n } from '../../../i18n/context'
import type { CemrrAspectKey, CemrrResult } from '../../../types/cemrr'

type GriHeroProps = {
  result: CemrrResult
}

const ASPECT_ORDER: CemrrAspectKey[] = ['S', 'V', 'B', 'E', 'STR']
const ASPECT_COLOR: Record<CemrrAspectKey, string> = {
  S: '#3b82f6',
  V: '#8b5cf6',
  B: 'rgb(16 185 129)',
  E: 'rgb(245 158 11)',
  STR: 'rgb(248 113 113)',
}

export function GriHero({ result }: GriHeroProps) {
  const { t } = useI18n()
  const ringColor = scoreColor(result.gri)
  const griPercent = Math.round(result.gri * 100)

  return (
    <article className="cemrr-hero">
      <div className="cemrr-hero__circle" style={{ borderColor: ringColor }}>
        <strong style={{ color: ringColor }}>{griPercent}%</strong>
        <span>{t.progress.cemrr.griLabel}</span>
      </div>

      <div className="cemrr-hero__body">
        <p className="eyebrow">{t.progress.cemrr.eyebrow}</p>
        <h2>{t.progress.cemrr.griTitle}</h2>

        <div className="cemrr-hero__bars">
          {ASPECT_ORDER.map((key) => {
            const value = result.aspects[key]
            const pct = Math.round(value * 100)
            return (
              <div className="cemrr-hero__bar" key={key}>
                <span className="cemrr-hero__bar-label">{t.progress.cemrr.aspects[key]}</span>
                <div className="cemrr-hero__bar-track">
                  <div
                    className="cemrr-hero__bar-fill"
                    style={{ width: `${pct}%`, background: ASPECT_COLOR[key] }}
                  />
                </div>
                <span className="cemrr-hero__bar-pct" style={{ color: ASPECT_COLOR[key] }}>
                  {pct}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </article>
  )
}

export function scoreColor(value: number): string {
  if (value >= 0.65) return 'rgb(16 185 129)'
  if (value >= 0.35) return 'rgb(245 158 11)'
  return 'rgb(248 113 113)'
}

export const ASPECT_COLORS = ASPECT_COLOR
export const ASPECT_KEYS = ASPECT_ORDER
