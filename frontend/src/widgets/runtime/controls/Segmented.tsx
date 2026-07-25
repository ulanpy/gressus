import { cn } from '@/shared/lib/utils'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

export function Segmented<T extends number | string>({
  onChange,
  options,
  value,
}: {
  onChange: (value: T) => void
  options: T[]
  value: T
}) {
  return (
    <ToggleGroup
      type="single"
      value={String(value)}
      onValueChange={(next) => {
        if (next) onChange(next as T)
      }}
      className="rounded-full bg-slate-200/65 p-1"
      role="group"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={String(option)}
          value={String(option)}
          className={cn(
            'rounded-full border-0 bg-transparent px-3.5 py-[7px] text-[13px] font-semibold text-text-strong shadow-none',
            'data-[state=on]:bg-white data-[state=on]:text-text-strong data-[state=on]:shadow-[0_6px_18px_rgb(15_23_42/0.1)]',
          )}
        >
          {String(option)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
