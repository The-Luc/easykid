import type { BabyEvent } from '../types'
import { formatTime } from '../lib/format'
import { EVENT_LABEL } from '../lib/meta'
import { timeline } from '../lib/stats'

/** A 24-hour strip showing feeds, activity and sleep blocks plus diaper dots. */
export default function Timeline({
  events,
  day,
  now,
}: {
  events: BabyEvent[]
  day: number
  now: number
}) {
  const { segments, diapers } = timeline(events, day, now)

  return (
    <div className="timeline">
      <div className="tl-track">
        {segments.map((s) => (
          <span
            key={s.id}
            className={`tl-seg ${s.type}`}
            style={{
              left: `${s.from * 100}%`,
              width: `${Math.max(0.5, (s.to - s.from) * 100)}%`,
            }}
            title={`${EVENT_LABEL[s.type]} ${formatTime(s.startMs)} – ${formatTime(s.endMs)}`}
          />
        ))}
        {diapers.map((d) => (
          <span
            key={d.id}
            className="tl-dot"
            style={{ left: `${d.at * 100}%` }}
            title={`Diaper ${formatTime(d.ms)}`}
          />
        ))}
      </div>
      <div className="tl-axis" aria-hidden="true">
        <span>12a</span>
        <span>6a</span>
        <span>12p</span>
        <span>6p</span>
        <span>12a</span>
      </div>
      <div className="tl-legend">
        <span>
          <i className="eat" /> Eat
        </span>
        <span>
          <i className="activity" /> Activity
        </span>
        <span>
          <i className="sleep" /> Sleep
        </span>
        <span>
          <i className="dot" /> Diaper
        </span>
      </div>
    </div>
  )
}
