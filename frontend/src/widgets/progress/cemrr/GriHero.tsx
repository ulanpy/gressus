import { useI18n } from '../../../i18n/context'
import type { CemrrAspectKey, CemrrResult } from '../../../types/cemrr'
import {
  cemrrHero,
  cemrrHeroBar,
  cemrrHeroBarFill,
  cemrrHeroBarLabel,
  cemrrHeroBarPct,
  cemrrHeroBars,
  cemrrHeroBarTrack,
  cemrrHeroBody,
  cemrrHeroCircle,
  cemrrHeroCircleLabel,
  cemrrHeroCircleValue,
  cemrrHeroTitle,
  eyebrow,
} from '../../../styles/ui'

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
    <article className={cemrrHero}>
      <div className={cemrrHeroCircle} style={{ borderColor: ringColor }}>
        <strong className={cemrrHeroCircleValue} style={{ color: ringColor }}>
          {griPercent}%
        </strong>
        <span className={cemrrHeroCircleLabel}>{t.progress.cemrr.griLabel}</span>
      </div>

      <div className={cemrrHeroBody}>
        <p className={eyebrow}>{t.progress.cemrr.eyebrow}</p>
        <h2 className={cemrrHeroTitle}>{t.progress.cemrr.griTitle}</h2>

        <div className={cemrrHeroBars}>
          {ASPECT_ORDER.map((key) => {
            const value = result.aspects[key]
            const pct = Math.round(value * 100)
            return (
              <div className={cemrrHeroBar} key={key}>
                <span className={cemrrHeroBarLabel}>{t.progress.cemrr.aspects[key]}</span>
                <div className={cemrrHeroBarTrack}>
                  <div
                    className={cemrrHeroBarFill}
                    style={{ width: `${pct}%`, background: ASPECT_COLOR[key] }}
                  />
                </div>
                <span className={cemrrHeroBarPct} style={{ color: ASPECT_COLOR[key] }}>
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
