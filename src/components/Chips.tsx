interface Option<T> {
  value: T
  label: string
}

/** Tap-to-select chips. Tapping the selected chip again clears it (when `clearable`). */
export default function Chips<T extends string | number>({
  options,
  value,
  onChange,
  clearable = false,
}: {
  options: Option<T>[]
  value: T | undefined
  onChange: (value: T | undefined) => void
  clearable?: boolean
}) {
  return (
    <div className="chips" role="group">
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            className={`chip${selected ? ' selected' : ''}`}
            aria-pressed={selected}
            onClick={() => onChange(selected && clearable ? undefined : o.value)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
