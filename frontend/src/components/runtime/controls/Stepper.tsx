
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
  return (
    <div className="runtime__stepper" role="group" aria-label="numeric stepper">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, Number((value - step).toFixed(decimals))))}
        disabled={value <= min}
        aria-label="decrement"
      >
        −
      </button>
      <span className="runtime__stepper-value">{display}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, Number((value + step).toFixed(decimals))))}
        disabled={value >= max}
        aria-label="increment"
      >
        +
      </button>
    </div>
  )
}
