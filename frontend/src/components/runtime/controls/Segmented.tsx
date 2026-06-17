import { cn } from '../../../lib/cn'

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
    <div className="inline-flex gap-0.5 rounded-full bg-slate-200/65 p-1" role="group">
      {options.map((option) => (
        <button
          key={String(option)}
          type="button"
          className={cn(
            'rounded-full border-0 bg-transparent px-3.5 py-[7px] text-[13px] font-semibold text-text-strong shadow-none',
            option === value && 'bg-white shadow-[0_6px_18px_rgb(15_23_42/0.1)]',
          )}
          onClick={() => onChange(option)}
        >
          {String(option)}
        </button>
      ))}
    </div>
  )
}
