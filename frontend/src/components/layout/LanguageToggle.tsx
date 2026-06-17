import { translations } from '../../i18n/translations'
import type { LanguageToggleProps } from '../../types/components'
import { cn } from '../../lib/cn'
import { pillNav, pillNavButtonActive } from '../../styles/ui'

export function LanguageToggle({ language, setLanguage }: LanguageToggleProps) {
  return (
    <div
      className={cn(pillNav, 'gap-[5px] max-sm:grid max-sm:grid-cols-3')}
      aria-label="Language"
    >
      {(['ru', 'en', 'kk'] as const).map((nextLanguage) => (
        <button
          type="button"
          key={nextLanguage}
          className={cn(
            'min-w-12 cursor-pointer rounded-full border-0 bg-transparent px-3 py-[9px] text-[13px] font-extrabold text-text-strong [font:inherit]',
            language === nextLanguage && pillNavButtonActive,
          )}
          onClick={() => setLanguage(nextLanguage)}
          title={translations[nextLanguage].langName}
        >
          {nextLanguage.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
