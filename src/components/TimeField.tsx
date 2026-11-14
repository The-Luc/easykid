import { useState } from 'react'
import { addDays, format, isToday, isYesterday } from 'date-fns'
import Wheel from './Wheel'

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const MINUTES = Array.from({ length: 60 }, (_, i) => i)
const MERIDIEM = ['AM', 'PM'] as const
const NUDGES = [-15, -5, 5, 15]

function dayLabel(ms: number) {
  if (isToday(ms)) return 'Today'
  if (isYesterday(ms)) return 'Yesterday'
  return format(ms, 'EEE, MMM d')
}

/**
 * Time-of-day picker (wheels or keyboard) with quick nudge buttons.
 * The date part is kept; picking a time later than now means the day before,
 * which suits night feeds logged just after midnight.
 */
export default function TimeField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (ms: number) => void
}) {
  const [typing, setTyping] = useState(false)

  const d = new Date(value)
  const h24 = d.getHours()
  const isPm = h24 >= 12
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const minute = d.getMinutes()

  const apply = (hours: number, minutes: number) => {
    const next = new Date(value)
    next.setHours(hours, minutes, 0, 0)
    onChange(next.getTime() > Date.now() ? addDays(next, -1).getTime() : next.getTime())
  }

  const nudge = (minutes: number) =>
    onChange(Math.min(Date.now(), value + minutes * 60_000))

  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">{label}</span>
        <button type="button" className="kbd-btn" onClick={() => setTyping((t) => !t)}>
          {typing ? '⇅ Scroll' : '⌨ Type'}
        </button>
      </div>

      {typing ? (
        <div className="field-body">
          <input
            className="time-input"
            type="time"
            aria-label={label}
            value={format(value, 'HH:mm')}
            onChange={(e) => {
              const [hh, mm] = e.target.value.split(':').map(Number)
              if (!Number.isNaN(hh) && !Number.isNaN(mm)) apply(hh, mm)
            }}
          />
        </div>
      ) : (
        <div className="time-wheels">
          <Wheel
            values={HOURS}
            value={h12}
            label="Hour"
            width={72}
            onChange={(h) => apply((h % 12) + (isPm ? 12 : 0), minute)}
          />
          <span className="colon">:</span>
          <Wheel
            values={MINUTES}
            value={minute}
            label="Minute"
            width={72}
            format={(m) => String(m).padStart(2, '0')}
            onChange={(m) => apply(h24, m)}
          />
          <Wheel
            values={MERIDIEM}
            value={isPm ? 'PM' : 'AM'}
            label="AM or PM"
            width={72}
            onChange={(p) => apply((h12 % 12) + (p === 'PM' ? 12 : 0), minute)}
          />
        </div>
      )}

      <p className="when-label">
        {dayLabel(value)} · {format(value, 'h:mm a')}
      </p>

      <div className="steppers">
        {NUDGES.map((n) => (
          <button key={n} type="button" className="chip" onClick={() => nudge(n)}>
            {n > 0 ? `+${n}` : `−${Math.abs(n)}`} min
          </button>
        ))}
        <button type="button" className="chip" onClick={() => onChange(Date.now())}>
          Now
        </button>
      </div>
    </div>
  )
}
