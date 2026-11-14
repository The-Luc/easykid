import { useMemo, useState } from 'react'
import Wheel from './Wheel'

/** Integers from `from` to `to` inclusive. */
function range(from: number, to: number, step: number) {
  const out: number[] = []
  for (let v = from; v <= to; v += step) out.push(v)
  return out
}

/**
 * A number you can set either by scrolling a wheel or by typing.
 * The wheel moves in `step` increments (decimals supported, e.g. 0.05);
 * typing accepts any value from `step` up to `max`.
 */
export default function WheelField({
  label,
  value,
  max,
  step = 1,
  decimals = 0,
  unit,
  hint,
  onChange,
}: {
  label: string
  value: number
  max: number
  step?: number
  /** digits after the decimal point shown on the wheel */
  decimals?: number
  unit?: string
  hint?: string
  onChange: (value: number) => void
}) {
  const [typing, setTyping] = useState(false)
  const [text, setText] = useState(String(value))

  // The wheel works on whole numbers (value × factor) to avoid float drift
  const factor = 10 ** decimals
  const stepScaled = Math.round(step * factor)
  const maxScaled = Math.round(max * factor)
  const values = useMemo(
    () => range(stepScaled, maxScaled, stepScaled),
    [stepScaled, maxScaled],
  )

  // The wheel can only show grid values, so show the nearest one
  const index = Math.round(Math.round(value * factor) / stepScaled) - 1
  const nearest = values[Math.min(values.length - 1, Math.max(0, index))]

  const toggle = () => {
    setText(String(value))
    setTyping((t) => !t)
  }

  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">{label}</span>
        <button type="button" className="kbd-btn" onClick={toggle}>
          {typing ? '⇅ Scroll' : '⌨ Type'}
        </button>
      </div>
      <div className="field-body">
        {typing ? (
          <input
            className="num-input"
            inputMode={decimals > 0 ? 'decimal' : 'numeric'}
            aria-label={label}
            value={text}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const raw = e.target.value.replace(decimals > 0 ? /[^0-9.]/g : /\D/g, '')
              setText(raw)
              const n = Number(raw)
              if (raw !== '' && !Number.isNaN(n) && n >= step && n <= max) {
                onChange(Math.round(n * factor) / factor)
              }
            }}
            onBlur={() => setText(String(value))}
          />
        ) : (
          <Wheel
            values={values}
            value={nearest}
            onChange={(n) => onChange(n / factor)}
            format={(n) => (n / factor).toFixed(decimals)}
            label={label}
            width={110}
          />
        )}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}
