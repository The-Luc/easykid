/*
 * An entry has a start, an end and a duration, but only two of them are independent.
 * The add/edit sheet asks for ONE time (the anchor: either the start or the end)
 * plus the duration, and calculates the other time. Changing the duration moves only
 * the calculated time, never the one you set.
 */

export type Anchor = 'start' | 'end'

const MIN = 60_000

/** Start and end of an entry, from the time the user set, which end it is, and the duration. */
export function resolveSpan(anchor: Anchor, anchorAt: number, durationMs: number) {
  return anchor === 'start'
    ? { startedAt: anchorAt, endedAt: anchorAt + durationMs }
    : { startedAt: anchorAt - durationMs, endedAt: anchorAt }
}

/** The anchor time to show after switching which end you set, so the entry itself does not change. */
export function switchAnchor(from: Anchor, anchorAt: number, durationMs: number): number {
  return from === 'start' ? anchorAt + durationMs : anchorAt - durationMs
}

/**
 * Whole minutes, at least 1. When the start is the anchor, the entry may not end after
 * `now`, so the duration is capped to the time that has passed since the start.
 */
export function clampDuration(
  anchor: Anchor,
  anchorAt: number,
  minutes: number,
  now: number,
): number {
  const whole = Math.max(1, Math.round(minutes))
  if (anchor === 'end') return whole
  const room = Math.floor((now - anchorAt) / MIN)
  return Math.min(whole, Math.max(1, room))
}
