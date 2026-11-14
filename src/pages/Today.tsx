import { useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import PageHead from '../components/PageHead'
import Chips from '../components/Chips'
import DayStats from '../components/DayStats'
import EventList from '../components/EventList'
import EventSheet from '../components/EventSheet'
import { daySummary, eventsOnDay, getOpenPhase } from '../lib/events'
import { formatClock, formatDuration, formatTime } from '../lib/format'
import { useEvents, useNow, useStore } from '../lib/hooks'
import { PHASES, PHASE_META } from '../lib/meta'
import { predictNextFeed } from '../lib/predict'
import { eventStore } from '../lib/store'
import { ageInWeeks, ageLabel } from '../lib/age'
import { profileStore } from '../lib/stores'
import type { BabyEvent, EventDetails } from '../types'

const SIDES = [
  { value: 'left' as const, label: 'Left' },
  { value: 'right' as const, label: 'Right' },
  { value: 'both' as const, label: 'Both' },
  { value: 'bottle' as const, label: '🍼 Bottle' },
]
const ML = [30, 60, 90, 120, 150].map((v) => ({ value: v, label: `${v} ml` }))

function greeting(now: number) {
  const h = new Date(now).getHours()
  if (h < 5) return 'Night shift 🌙'
  if (h < 12) return 'Good morning ☀️'
  if (h < 18) return 'Good afternoon 👋'
  return 'Good evening 🌆'
}

export default function Today() {
  const events = useEvents()
  const now = useNow(1000)
  const [sheet, setSheet] = useState<{ event?: BabyEvent } | null>(null)

  const open = getOpenPhase(events)
  const today = eventsOnDay(events, now)
  const summary = daySummary(events, now, now)
  const profile = useStore(profileStore)
  const age = ageLabel(profile.birthDate, now)
  const prediction = predictNextFeed(events, now, ageInWeeks(profile.birthDate, now))

  const setDetails = (patch: Partial<EventDetails>) => {
    if (open) eventStore.update(open.id, { details: { ...open.details, ...patch } })
  }

  const pickSide = (side: EventDetails['side']) =>
    setDetails(
      side === 'bottle'
        ? { side, ml: open?.details.ml ?? 90 }
        : { side, ml: undefined },
    )

  const logDiaper = (kind: 'wet' | 'dirty' | 'both') => {
    const t = Date.now()
    eventStore.add({
      type: 'diaper',
      startedAt: t,
      endedAt: t,
      details: { diaper: kind },
    })
  }

  return (
    <>
      <PageHead
        eyebrow={
          profile.name || age
            ? `${[profile.name, age].filter(Boolean).join(' · ')}`
            : greeting(now)
        }
        title={format(now, 'EEEE, MMM d')}
        action={
          <button type="button" className="btn-pill" onClick={() => setSheet({})}>
            + Add
          </button>
        }
      />
      <div className="stack">
        {/* Current phase */}
        {open ? (
          <section className={`current ${open.type}`}>
            <p className="current-label">{PHASE_META[open.type].active}</p>
            <p className="timer">{formatClock(now - open.startedAt)}</p>
            <p className="current-sub">since {formatTime(open.startedAt)}</p>
            {open.type === 'eat' && (
              <div className="current-chips">
                <Chips
                  options={SIDES}
                  value={open.details.side}
                  onChange={pickSide}
                  clearable
                />
                {open.details.side === 'bottle' && (
                  <Chips
                    options={ML}
                    value={open.details.ml}
                    onChange={(ml) => setDetails({ ml })}
                  />
                )}
              </div>
            )}
            <button
              type="button"
              className="btn btn-light"
              onClick={() => eventStore.stopPhase()}
            >
              {open.type === 'eat' ? 'Done eating' : 'Stop'}
            </button>
            <button
              type="button"
              className="link-btn link-light"
              onClick={() => setSheet({ event: open })}
            >
              Edit start time or details
            </button>
          </section>
        ) : (
          <section className="card idle">
            <p className="idle-title">Nothing running</p>
            <p className="muted">Tap Eat or Sleep to start the timer.</p>
          </section>
        )}

        {/* E.A.S.Y. tiles */}
        <div className="phases">
          {PHASES.map((p) => {
            const meta = PHASE_META[p]

            // Y is calculated from sleep, not tapped
            if (p === 'you') {
              return (
                <div
                  key={p}
                  className={`phase you${open?.type === 'sleep' ? ' active' : ''}`}
                >
                  <span className="letter">{meta.letter}</span>
                  <span className="name">{meta.name}</span>
                  <span className="hint">
                    {summary.sleepMs > 0
                      ? `${formatDuration(summary.sleepMs)} free today`
                      : meta.hint}
                  </span>
                </div>
              )
            }

            const active = open?.type === p
            return (
              <button
                key={p}
                type="button"
                className={`phase ${p}${active ? ' active' : ''}`}
                aria-pressed={active}
                onClick={() =>
                  active ? eventStore.stopPhase() : eventStore.startPhase(p)
                }
              >
                <span className="letter">{meta.letter}</span>
                <span className="name">{meta.name}</span>
                <span className="hint">{active ? 'Tap to stop' : meta.hint}</span>
              </button>
            )
          })}
        </div>

        {/* Quick diaper */}
        <section className="card">
          <h2>Diaper 🧷</h2>
          <div className="row-3">
            <button type="button" className="btn btn-soft" onClick={() => logDiaper('wet')}>
              💧 Wet
            </button>
            <button type="button" className="btn btn-soft" onClick={() => logDiaper('dirty')}>
              💩 Dirty
            </button>
            <button type="button" className="btn btn-soft" onClick={() => logDiaper('both')}>
              Both
            </button>
          </div>
        </section>

        {/* Next likely feed */}
        <section className="card next">
          <h2>Next likely feed</h2>
          {prediction ? (
            <>
              <p className="next-time">{formatTime(prediction.at)}</p>
              <p className="next-sub">
                {prediction.at > now
                  ? `in ${formatDuration(prediction.at - now)}`
                  : `due now · ${formatDuration(now - prediction.at)} ago`}
              </p>
              <p className="muted small">
                {prediction.basis === 'average'
                  ? `Based on your average of ${formatDuration(prediction.gapMs)} between feeds`
                  : `Typical ${formatDuration(prediction.gapMs)} gap for a newborn. It adapts as you log more feeds.`}
              </p>
            </>
          ) : (
            <p className="muted">Log a feed to see when the next one is likely.</p>
          )}
        </section>

        <DayStats summary={summary} />

        {/* Recent */}
        <section className="card">
          <h2>Today</h2>
          <EventList
            events={today.slice(0, 6)}
            now={now}
            onSelect={(event) => setSheet({ event })}
          />
          {today.length > 6 && (
            <Link to="/history" className="see-all">
              See all {today.length} →
            </Link>
          )}
        </section>
      </div>

      {sheet && (
        <EventSheet
          key={sheet.event?.id ?? 'new'}
          event={sheet.event}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  )
}
