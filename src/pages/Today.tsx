import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import PageHead from '../components/PageHead'
import Chips from '../components/Chips'
import DayStats from '../components/DayStats'
import EventList from '../components/EventList'
import EventSheet from '../components/EventSheet'
import MilkSection from '../components/MilkSection'
import SyncPill from '../components/SyncPill'
import { awakeSince, withDerived } from '../lib/awake'
import { daySummary, eventsOnDay, getOpenPhase } from '../lib/events'
import { formatClock, formatDuration, formatTime } from '../lib/format'
import { useEvents, useNow, useStore } from '../lib/hooks'
import { PHASE_META } from '../lib/meta'
import { predictNextFeed } from '../lib/predict'
import { availableBags, expiry, stashSummary, storedBags, volumeOf } from '../lib/storage'
import { eventStore } from '../lib/store'
import { ageInWeeks, ageLabel } from '../lib/age'
import { bagStore, profileStore } from '../lib/stores'
import type { BabyEvent, EventDetails, EventType } from '../types'

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
  const [sheet, setSheet] = useState<{ event?: BabyEvent; type?: EventType } | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null)

  const open = getOpenPhase(events)
  // Activity is calculated from eat and sleep times; it is shown but never saved
  const today = eventsOnDay(withDerived(events, now), now)
  const awake = awakeSince(events, now)
  const activityMs = today
    .filter((e) => e.type === 'activity')
    .reduce((sum, e) => sum + ((e.endedAt ?? now) - e.startedAt), 0)
  const summary = daySummary(events, now, now)

  // "Tap again to discard" goes back to "Cancel" after a few seconds
  useEffect(() => {
    if (!confirmCancel) return
    const t = setTimeout(() => setConfirmCancel(null), 4000)
    return () => clearTimeout(t)
  }, [confirmCancel])

  const cancelTimer = () => {
    if (!open) return
    if (confirmCancel === open.id) {
      eventStore.cancelPhase()
      setConfirmCancel(null)
    } else {
      setConfirmCancel(open.id)
    }
  }
  const profile = useStore(profileStore)
  const bags = useStore(bagStore)
  const stash = stashSummary(bags, events, now)
  const stored = storedBags(bags, events)
  const expiredBags = stored.filter((b) => expiry(b, now).state === 'expired').length
  const soonBags = stored.filter((b) => expiry(b, now).state === 'soon').length
  const age = ageLabel(profile.birthDate, now)
  const prediction = predictNextFeed(events, now, ageInWeeks(profile.birthDate, now))

  const setDetails = (patch: Partial<EventDetails>) => {
    if (open) eventStore.update(open.id, { details: { ...open.details, ...patch } })
  }

  const pickSide = (side: EventDetails['side']) =>
    setDetails(
      side === 'bottle'
        ? { side, ml: open?.details.ml ?? 90 }
        : { side, ml: undefined, milk: undefined, bagIds: undefined },
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
          <div className="head-actions">
            <SyncPill />
            <button type="button" className="btn-pill" onClick={() => setSheet({})}>
              + Add
            </button>
          </div>
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
                  <>
                    <Chips
                      options={ML}
                      value={open.details.ml}
                      onChange={(ml) => setDetails({ ml })}
                    />
                    <MilkSection
                      milk={open.details.milk}
                      bagIds={open.details.bagIds ?? []}
                      bags={availableBags(bags, events, open.id)}
                      now={now}
                      onMilk={(milk) =>
                        setDetails(milk === 'pumped' ? { milk } : { milk, bagIds: undefined })
                      }
                      onBags={(ids) =>
                        setDetails(
                          ids.length > 0
                            ? {
                                bagIds: ids,
                                ml: volumeOf(availableBags(bags, events, open.id), ids),
                              }
                            : { bagIds: undefined },
                        )
                      }
                    />
                  </>
                )}
              </div>
            )}
            <div className="current-actions">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => eventStore.stopPhase()}
              >
                {open.type === 'eat' ? 'Done eating' : 'Stop'}
              </button>
              <button type="button" className="btn btn-ghost-light" onClick={cancelTimer}>
                {confirmCancel === open.id ? 'Tap again to discard' : 'Cancel'}
              </button>
            </div>
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
            {awake !== undefined ? (
              <>
                <p className="idle-title">Awake {formatDuration(now - awake)}</p>
                <p className="muted">
                  Since {formatTime(awake)} · activity is calculated for you. Tap Eat or
                  Sleep when it is time.
                </p>
              </>
            ) : (
              <>
                <p className="idle-title">Nothing running</p>
                <p className="muted">Tap Eat or Sleep to start the timer.</p>
              </>
            )}
          </section>
        )}

        {/* E.A.S.Y. tiles */}
        {/* Left: the two things you time. Right: Activity and You (calculated) and Pump. */}
        <div className="phase-columns">
          <div className="phase-col main">
            {(['eat', 'sleep'] as const).map((p) => {
              const meta = PHASE_META[p]
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

          <div className="phase-col side">
            {/* A and Y are calculated from your eat and sleep times, so they are shown a
                bit gray with an AUTO badge. Tapping one still lets you add that record by
                hand (a timer would clash with a running sleep). */}
            {(['activity', 'you'] as const).map((p) => {
              const meta = PHASE_META[p]
              const isActivity = p === 'activity'
              const live = isActivity ? awake !== undefined : open?.type === 'sleep'
              const hint = isActivity
                ? awake !== undefined
                  ? `Awake ${formatDuration(now - awake)}`
                  : activityMs > 0
                    ? `${formatDuration(activityMs)} today`
                    : meta.hint
                : summary.sleepMs > 0
                  ? `${formatDuration(summary.sleepMs)} free today`
                  : meta.hint
              return (
                <button
                  key={p}
                  type="button"
                  className={`phase auto ${p}${live ? ' live' : ''}`}
                  aria-label={`${meta.name}: calculated automatically (${hint}). Tap to add a ${meta.name.toLowerCase()} entry by hand.`}
                  onClick={() => setSheet({ type: p })}
                >
                  <span className="auto-badge">AUTO</span>
                  <span className="letter">{meta.letter}</span>
                  <span className="name">{meta.name}</span>
                  <span className="hint">{hint}</span>
                </button>
              )
            })}

            {/* Breast pump: logged by hand (no timer), so it opens the Add sheet */}
            <button
              type="button"
              className="phase pump"
              aria-label="Log a breast pump session"
              onClick={() => setSheet({ type: 'pump' })}
            >
              <span className="letter">🥛</span>
              <span className="name">Pump</span>
              <span className="hint">
                {summary.pumpMl > 0
                  ? `${summary.pumpMl} ml today`
                  : summary.pumps > 0
                    ? `${summary.pumps} today`
                    : 'Tap to log'}
              </span>
            </button>
          </div>
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

        {/* Milk storage */}
        {bags.length > 0 && (
          <Link to="/storage" className="card stash-card">
            <h2>🧊 Milk stash</h2>
            <p className="stash-main">
              {stash.bags} bag{stash.bags === 1 ? '' : 's'} · {stash.ml} ml
            </p>
            <p className="muted small">
              {stash.freezer.bags} freezer · {stash.fridge.bags} fridge
              {expiredBags > 0
                ? ` · ⚠ ${expiredBags} past use-by`
                : soonBags > 0
                  ? ` · ${soonBags} to use soon`
                  : ''}
            </p>
          </Link>
        )}

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
          <div className="events-scroll">
            <EventList
              events={today}
              now={now}
              onSelect={(event) => setSheet({ event })}
            />
          </div>
        </section>
      </div>

      {sheet && (
        <EventSheet
          key={sheet.event?.id ?? `new-${sheet.type ?? 'any'}`}
          event={sheet.event}
          initialType={sheet.type}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  )
}
