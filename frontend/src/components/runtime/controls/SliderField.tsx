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
    <div className="runtime__slider-field">
      <div className="runtime__slider-head">
        <span className="runtime__slider-label">{label}</span>
        {hint && <span className="runtime__field-hint">{hint}</span>}
        <span className="runtime__slider-value">{format(value)}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}
