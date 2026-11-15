import type { BabyEvent } from '../types'
import { isDerived } from '../lib/awake'
import { EVENT_EMOJI, EVENT_LABEL } from '../lib/meta'
import { formatDuration, formatTime } from '../lib/format'

const SIDE = {
  left: 'Left',
  right: 'Right',
  both: 'Both sides',
  bottle: 'Bottle',
} as const
const DIAPER = { wet: 'Wet', dirty: 'Dirty', both: 'Wet + dirty' } as const

function summary(e: BabyEvent, now: number): string {
  const parts: string[] = []
  if (e.type === 'diaper' && e.details.diaper) parts.push(DIAPER[e.details.diaper])
  if (e.details.side) parts.push(SIDE[e.details.side])
  if (e.details.ml) parts.push(`${e.details.ml} ml`)
  const end = e.endedAt ?? now
  if (e.type !== 'diaper' && end - e.startedAt >= 60_000) {
    parts.push(formatDuration(end - e.startedAt) + (e.endedAt === null ? ' so far' : ''))
  }
  if (e.notes) parts.push(e.notes)
  return parts.join(' · ')
}

/** Tap a row to edit it. Calculated (auto) rows are shown muted and cannot be edited. */
export default function EventList({
  events,
  now,
  onSelect,
  empty = 'Nothing logged yet',
}: {
  events: BabyEvent[]
  now: number
  onSelect: (event: BabyEvent) => void
  empty?: string
}) {
  if (events.length === 0) return <p className="muted">{empty}</p>
  return (
    <ul className="events">
      {events.map((e) => {
        if (isDerived(e)) {
          return (
            <li key={e.id}>
              <div
                className="event event-auto"
                title="Calculated from your eat and sleep times"
              >
                <span className="event-icon">{EVENT_EMOJI.activity}</span>
                <span className="event-main">
                  <span className="event-title">
                    {EVENT_LABEL.activity} <span className="auto-tag">auto</span>
                  </span>
                  <span className="event-sub">
                    Calculated · {formatDuration((e.endedAt ?? now) - e.startedAt)}
                    {e.endedAt === null ? ' so far' : ''}
                  </span>
                </span>
                <span className="event-time">{formatTime(e.startedAt)}</span>
                <span />
              </div>
            </li>
          )
        }

        return (
          <li key={e.id}>
            <button
              type="button"
              className={`event ${e.type}`}
              aria-label={`Edit ${EVENT_LABEL[e.type]} at ${formatTime(e.startedAt)}`}
              onClick={() => onSelect(e)}
            >
              <span className="event-icon">{EVENT_EMOJI[e.type]}</span>
              <span className="event-main">
                <span className="event-title">{EVENT_LABEL[e.type]}</span>
                <span className="event-sub">{summary(e, now) || ' '}</span>
              </span>
              <span className="event-time">{formatTime(e.startedAt)}</span>
              <span className="event-chev" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
