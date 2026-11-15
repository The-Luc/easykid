import { useState } from 'react'
import type { BabyEvent, EventType } from '../types'
import { DERIVED_PREFIX, withDerived } from '../lib/awake'
import { formatDuration, formatTime } from '../lib/format'
import { EVENT_LABEL } from '../lib/meta'
import { timeline } from '../lib/stats'

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_LABELS = ['12a', '2a', '4a', '6a', '8a', '10a', '12p', '2p', '4p', '6p', '8p', '10p', '12a']

/** One row per kind of event so nothing overlaps. "you" only shows when used. */
const LANES: { type: EventType; optional?: boolean }[] = [
  { type: 'eat' },
  { type: 'activity' },
  { type: 'sleep' },
  { type: 'you', optional: true },
  { type: 'pump' },
  { type: 'diaper' },
]

/** A 24-hour chart with a lane per event type, hour grid, "now" line and daily totals. */
export default function Timeline({
  events,
  day,
  now,
}: {
  events: BabyEvent[]
  day: number
  now: number
}) {
  const [picked, setPicked] = useState<string | null>(null)
  // calculated activity (awake time after a feed) is drawn hatched
  const { segments, diapers } = timeline(withDerived(events, now), day, now)
  const nowAt = now >= day && now < day + DAY_MS ? (now - day) / DAY_MS : null

  const lanes = LANES.filter(
    (l) => !l.optional || segments.some((s) => s.type === l.type),
  )

  const detail = (() => {
    if (!picked) return null
    const s = segments.find((x) => x.id === picked)
    if (s) {
      const auto = s.id.startsWith(DERIVED_PREFIX) ? ' (auto)' : ''
      return `${EVENT_LABEL[s.type]}${auto} · ${formatTime(s.startMs)} – ${formatTime(s.endMs)} · ${formatDuration(s.endMs - s.startMs)}`
    }
    const d = diapers.find((x) => x.id === picked)
    return d ? `Diaper · ${formatTime(d.ms)}` : null
  })()

  function summary(type: EventType): string {
    if (type === 'diaper') return diapers.length ? `${diapers.length}×` : '–'
    const own = segments.filter((s) => s.type === type && !s.id.startsWith(DERIVED_PREFIX))
    if (own.length === 0) return '–'
    const ms = own.reduce((sum, s) => sum + (s.to - s.from) * DAY_MS, 0)
    return type === 'sleep' || type === 'you'
      ? formatDuration(ms)
      : `${own.length}× · ${formatDuration(ms)}`
  }

  return (
    <div className="timeline">
      <div className="tl-scroll">
        <div className="tl-board">
          <div className="tl-axis" aria-hidden="true">
            <span className="tl-label" />
            <div className="tl-plot">
              {HOUR_LABELS.map((h, i) => (
                <span key={i} style={{ left: `${(i / 12) * 100}%` }}>
                  {h}
                </span>
              ))}
            </div>
          </div>

          {lanes.map((lane) => (
            <div key={lane.type} className="tl-row">
              <div className="tl-label">
                <strong>{EVENT_LABEL[lane.type]}</strong>
                <small>{summary(lane.type)}</small>
              </div>
              <div className="tl-plot tl-lane">
                {lane.type === 'diaper'
                  ? diapers.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className={`tl-dot${picked === d.id ? ' picked' : ''}`}
                        style={{ left: `${d.at * 100}%` }}
                        title={`Diaper ${formatTime(d.ms)}`}
                        aria-label={`Diaper ${formatTime(d.ms)}`}
                        onClick={() => setPicked(picked === d.id ? null : d.id)}
                      />
                    ))
                  : segments
                      .filter((s) => s.type === lane.type)
                      .map((s) => {
                        const width = s.to - s.from
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className={`tl-seg ${s.type}${s.id.startsWith(DERIVED_PREFIX) ? ' auto' : ''}${picked === s.id ? ' picked' : ''}`}
                            style={{
                              left: `${s.from * 100}%`,
                              width: `${Math.max(0.6, width * 100)}%`,
                            }}
                            title={`${EVENT_LABEL[s.type]} ${formatTime(s.startMs)} – ${formatTime(s.endMs)}`}
                            onClick={() => setPicked(picked === s.id ? null : s.id)}
                          >
                            {width >= 0.07 && !s.id.startsWith(DERIVED_PREFIX)
                              ? formatDuration(s.endMs - s.startMs)
                              : null}
                          </button>
                        )
                      })}
              </div>
            </div>
          ))}

          {nowAt !== null && (
            <div className="tl-now-wrap" aria-hidden="true">
              <span className="tl-label" />
              <div className="tl-plot">
                <i className="tl-now" style={{ left: `${nowAt * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="tl-detail" aria-live="polite">
        {detail ?? 'Tap a block to see its time. Swipe sideways on small screens.'}
      </p>

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
          <i className="pump" /> Pump
        </span>
        <span>
          <i className="sleep" /> Sleep
        </span>
        <span>
          <i className="dot" /> Diaper
        </span>
        {nowAt !== null && (
          <span>
            <i className="now" /> Now
          </span>
        )}
      </div>
    </div>
  )
}
