import { translations } from '@/i18n/translations'
import type { LanguageToggleProps } from '@/types/components'
import { cn } from '@/shared/lib/utils'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

export function LanguageToggle({ language, setLanguage }: LanguageToggleProps) {
  return (
    <ToggleGroup
      type="single"
      spacing={1}
      value={language}
      onValueChange={(next) => {
        if (next === 'ru' || next === 'en' || next === 'kk') setLanguage(next)
      }}
      aria-label="Language"
      className="inline-flex gap-0.5 rounded-xl border border-border bg-white p-1 shadow-panel"
    >
      {(['ru', 'en', 'kk'] as const).map((nextLanguage) => (
        <ToggleGroupItem
          key={nextLanguage}
          value={nextLanguage}
          title={translations[nextLanguage].langName}
          className={cn(
            'min-w-10 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-[13px] font-semibold text-slate-500 shadow-none',
            'data-[state=on]:bg-slate-900 data-[state=on]:text-white data-[state=on]:shadow-none',
            'hover:bg-slate-50 hover:text-slate-800 data-[state=on]:hover:bg-slate-900 data-[state=on]:hover:text-white',
          )}
        >
          {nextLanguage.toUpperCase()}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
