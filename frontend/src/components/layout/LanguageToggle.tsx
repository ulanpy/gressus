import { translations } from '../../i18n/translations'
import type { LanguageToggleProps } from '../../types/components'


export function LanguageToggle({ language, setLanguage }: LanguageToggleProps) {
  return (
    <div className="language-toggle" aria-label="Language">
      {(['ru', 'en', 'kk'] as const).map((nextLanguage) => (
        <button
          type="button"
          key={nextLanguage}
          className={language === nextLanguage ? 'active' : ''}
          onClick={() => setLanguage(nextLanguage)}
          title={translations[nextLanguage].langName}
        >
          {nextLanguage.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
