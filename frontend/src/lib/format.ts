import type { Language } from '../types/i18n'
import { dateLocale } from './dateLocale'


export function formatKpa(value: number) {
  return `${Math.round(value)} kPa`
}

export function formatShortDate(date: string, language: Language) {
  return new Intl.DateTimeFormat(dateLocale(language), { month: 'short', day: 'numeric' }).format(new Date(date))
}

export function formatMetricValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
export function percentImprovement(baseline: number, latest: number) {
  return baseline === 0 ? 0 : ((latest - baseline) / baseline) * 100
}

export function percentReduction(baseline: number, latest: number) {
  return baseline === 0 ? 0 : ((baseline - latest) / baseline) * 100
}

export function formatSignedPercent(value: number) {
  const rounded = Math.round(value)

  return `${rounded > 0 ? '+' : ''}${rounded}%`
}
