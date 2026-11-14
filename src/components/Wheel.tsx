import { useEffect, useRef } from 'react'

/** Height of one row. Must match `.wheel-item` in sheet.css. */
const ITEM = 44

/**
 * Vertical snap-scrolling picker. Works with touch, mouse wheel,
 * clicking a row, and the ↑ / ↓ keys.
 */
export default function Wheel<T extends string | number>({
  values,
  value,
  onChange,
  label,
  format,
  width,
}: {
  values: readonly T[]
  value: T
  onChange: (value: T) => void
  label: string
  format?: (value: T) => string
  width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const index = Math.max(0, values.indexOf(value))

  // Keep the scroll position in sync when the value changes from outside
  useEffect(() => {
    const el = ref.current
    if (el && Math.abs(el.scrollTop - index * ITEM) > 1) {
      el.scrollTop = index * ITEM
    }
  }, [index])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Once scrolling settles, read which row is centered
  const settle = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = Math.min(
        values.length - 1,
        Math.max(0, Math.round(el.scrollTop / ITEM)),
      )
      if (values[i] !== value) onChange(values[i])
    }, 100)
  }

  const move = (delta: number) => {
    const i = Math.min(values.length - 1, Math.max(0, index + delta))
    if (values[i] !== value) onChange(values[i])
  }

  return (
    <div className="wheel-wrap" style={width ? { width } : undefined}>
      <div
        ref={ref}
        className="wheel"
        role="listbox"
        tabIndex={0}
        aria-label={label}
        onScroll={settle}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            move(-1)
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            move(1)
          }
        }}
      >
        {values.map((v, i) => (
          <div
            key={String(v)}
            role="option"
            aria-selected={i === index}
            className={`wheel-item${i === index ? ' selected' : ''}`}
            onClick={() => onChange(v)}
          >
            {format ? format(v) : String(v)}
          </div>
        ))}
      </div>
    </div>
  )
}
