import type { Language } from '../types/i18n'


export function dateLocale(language: Language) {
  switch (language) {
    case 'kk':
      return 'kk-KZ'
    case 'ru':
      return 'ru-RU'
    case 'en':
      return 'en'
  }
}
