
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
    <div className="runtime__segmented" role="group">
      {options.map((option) => (
        <button
          key={String(option)}
          type="button"
          className={option === value ? 'active' : ''}
          onClick={() => onChange(option)}
        >
          {String(option)}
        </button>
      ))}
    </div>
  )
}
