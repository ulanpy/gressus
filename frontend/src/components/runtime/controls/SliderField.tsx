export function SliderField({
  format,
  hint,
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  format: (value: number) => string
  hint?: string
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  step: number
  value: number
}) {
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-2.5">
        <span className="text-sm font-semibold text-text-strong">{label}</span>
        {hint && <span className="text-xs font-medium text-muted">{hint}</span>}
        <span className="rounded-[10px] bg-slate-900 px-2.5 py-1 text-[13px] font-bold tracking-[0.02em] text-white tabular-nums">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        className="runtime-range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}
