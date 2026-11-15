import type { BabyEvent } from '../types'
import { getOpenPhase } from './events'

/*
 * Activity is not something you log with a timer: it is the awake time between
 * the end of a feed or a sleep (a wake-up) and whatever comes next. It is
 * calculated here from eat and sleep entries, never stored, and so never synced;
 * every phone works out the same result from the same entries.
 */

const MIN = 60_000
/** A calculated window shorter than this is noise (for example, sleep tapped right after a feed). */
const MIN_AWAKE_MS = 5 * MIN
/** Longer than this usually means a sleep was not logged, so do not invent an activity. */
const MAX_AWAKE_MS = 4 * 60 * MIN

export const DERIVED_PREFIX = 'auto:'

/** True for calculated (not stored) activity entries. */
export const isDerived = (e: Pick<BabyEvent, 'id'>) => e.id.startsWith(DERIVED_PREFIX)

/** The id of the feed or sleep a calculated activity follows (where its comment is saved). */
export const derivedSourceId = (e: Pick<BabyEvent, 'id'>) => e.id.slice(DERIVED_PREFIX.length)

/**
 * Calculated activity entries, one per finished feed or sleep that is followed by a sensible
 * awake window. A window still open (nothing logged after it yet) has `endedAt: null`.
 * If you logged an Activity yourself inside a window, yours wins and none is calculated.
 */
export function derivedActivity(events: BabyEvent[], now: number): BabyEvent[] {
  const anchors = events
    .filter((e) => e.type === 'eat' || e.type === 'sleep')
    .sort((a, b) => a.startedAt - b.startedAt)
  const manual = events.filter((e) => e.type === 'activity' && !isDerived(e))
  const out: BabyEvent[] = []

  for (const feed of anchors) {
    if (feed.endedAt === null) continue
    const start = feed.endedAt
    // The first feed or sleep that has not finished before this one ended. One that is
    // running, or that overlaps it, is found too; its start is then at or before
    // `start`, the window has no length, and it is skipped (the baby is not awake).
    const next = anchors.find((e) => e.id !== feed.id && (e.endedAt ?? Infinity) > start)
    const end = next ? next.startedAt : now

    const length = end - start
    if (length < MIN_AWAKE_MS || length > MAX_AWAKE_MS) continue
    if (manual.some((m) => m.startedAt < end && (m.endedAt ?? now) > start)) continue

    out.push({
      id: `${DERIVED_PREFIX}${feed.id}`,
      type: 'activity',
      startedAt: start,
      endedAt: next ? end : null,
      details: {},
      // A comment on a calculated activity lives on its feed, so it never makes it manual
      ...(feed.details.activityNote ? { notes: feed.details.activityNote } : {}),
    })
  }
  return out
}

/** Real entries plus calculated activity, for display. Calculated ones are never saved. */
export function withDerived(events: BabyEvent[], now: number): BabyEvent[] {
  return [...events, ...derivedActivity(events, now)]
}

/**
 * When the baby last woke or finished a feed, if nothing is running and it was recent.
 * Used for the live "Awake 25m" display.
 */
export function awakeSince(events: BabyEvent[], now: number): number | undefined {
  if (getOpenPhase(events)) return undefined

  let last = -Infinity
  for (const e of events) {
    if ((e.type === 'eat' || e.type === 'sleep') && e.endedAt !== null && e.endedAt > last) {
      last = e.endedAt
    }
  }
  if (last === -Infinity) return undefined

  const awake = now - last
  return awake >= 0 && awake <= MAX_AWAKE_MS ? last : undefined
}
