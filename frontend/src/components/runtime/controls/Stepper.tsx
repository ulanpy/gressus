export function Stepper({
  max,
  min,
  onChange,
  step,
  value,
}: {
  max: number
  min: number
  onChange: (value: number) => void
  step: number
  value: number
}) {
  const decimals = step < 1 ? Math.max(0, -Math.floor(Math.log10(step))) : 0
  const display = value.toFixed(decimals)
  const buttonClass =
    'h-8 w-8 rounded-full border-0 bg-transparent p-0 text-lg font-bold text-text-strong shadow-none hover:enabled:bg-slate-200/80 disabled:cursor-not-allowed disabled:opacity-35'
  return (
    <div className="inline-flex w-fit items-center gap-0 rounded-full border border-panel-border bg-white p-1" role="group" aria-label="numeric stepper">
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(Math.max(min, Number((value - step).toFixed(decimals))))}
        disabled={value <= min}
        aria-label="decrement"
      >
        −
      </button>
      <span className="min-w-14 px-2 text-center font-semibold text-text-strong tabular-nums">{display}</span>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(Math.min(max, Number((value + step).toFixed(decimals))))}
        disabled={value >= max}
        aria-label="increment"
      >
        +
      </button>
    </div>
  )
}
