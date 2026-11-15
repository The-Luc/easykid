import type { BabyEvent } from '../types'
import { DERIVED_PREFIX, withDerived } from '../lib/awake'
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
  // calculated activity (awake time after a feed) is drawn hatched
  const { segments, diapers } = timeline(withDerived(events, now), day, now)

  return (
    <div className="timeline">
      <div className="tl-track">
        {segments.map((s) => (
          <span
            key={s.id}
            className={`tl-seg ${s.type}${s.id.startsWith(DERIVED_PREFIX) ? ' auto' : ''}`}
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
          <i className="auto" /> Auto
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
