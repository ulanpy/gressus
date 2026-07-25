import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

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
    <div
      className="inline-flex w-fit items-center gap-0 rounded-full border border-panel-border bg-white p-1"
      role="group"
      aria-label="numeric stepper"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('h-8 w-8 rounded-full text-lg font-bold')}
        onClick={() => onChange(Math.max(min, Number((value - step).toFixed(decimals))))}
        disabled={value <= min}
        aria-label="decrement"
      >
        −
      </Button>
      <span className="min-w-14 px-2 text-center font-semibold text-text-strong tabular-nums">{display}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('h-8 w-8 rounded-full text-lg font-bold')}
        onClick={() => onChange(Math.min(max, Number((value + step).toFixed(decimals))))}
        disabled={value >= max}
        aria-label="increment"
      >
        +
      </Button>
    </div>
  )
}
