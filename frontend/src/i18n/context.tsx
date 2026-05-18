import { createContext, useContext } from 'react'
import type { Language } from '../types/i18n'
import { translations, type Translation } from './translations'

export const I18nContext = createContext<{ language: Language; t: Translation }>({
  language: 'ru',
  t: translations.ru,
})

export function useI18n() {
  return useContext(I18nContext)
}
