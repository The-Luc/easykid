import { addDays, startOfDay } from 'date-fns'
import type { BabyEvent, EventType } from '../types'

const HOUR = 3_600_000
const MIN = 60_000

export function overlapMs(start: number, end: number, from: number, to: number) {
  return Math.max(0, Math.min(end, to) - Math.max(start, from))
}

/** Start-of-day timestamps for the last `days` days, oldest first (today last). */
export function dayStarts(now: number, days: number): number[] {
  const today = startOfDay(now)
  return Array.from({ length: days }, (_, i) =>
    addDays(today, i - (days - 1)).getTime(),
  )
}

export interface DayTotals {
  day: number
  sleepMs: number
  feeds: number
  ml: number
  diapers: number
  /** breast-pump sessions, total amount (ml) and total time */
  pumps: number
  pumpMl: number
  pumpMs: number
}

/** Per-day totals. Sleep is split across midnight, so overnight sleep counts on both days. */
export function dailyTotals(events: BabyEvent[], now: number, days: number): DayTotals[] {
  return dayStarts(now, days).map((day) => {
    const end = addDays(day, 1).getTime()
    const t: DayTotals = {
      day,
      sleepMs: 0,
      feeds: 0,
      ml: 0,
      diapers: 0,
      pumps: 0,
      pumpMl: 0,
      pumpMs: 0,
    }
    for (const e of events) {
      if (e.type === 'sleep') {
        t.sleepMs += overlapMs(e.startedAt, e.endedAt ?? now, day, end)
      } else if (e.startedAt >= day && e.startedAt < end) {
        if (e.type === 'eat') {
          t.feeds += 1
          t.ml += e.details.ml ?? 0
        } else if (e.type === 'diaper') {
          t.diapers += 1
        } else if (e.type === 'pump') {
          t.pumps += 1
          t.pumpMl += e.details.ml ?? 0
          t.pumpMs += (e.endedAt ?? e.startedAt) - e.startedAt
        }
      }
    }
    return t
  })
}

/** Average gap between feed starts per day (gaps over 6h or under 1h are ignored). */
export function feedGapsByDay(
  events: BabyEvent[],
  now: number,
  days: number,
): { day: number; gapMs: number | null }[] {
  const starts = events
    .filter((e) => e.type === 'eat')
    .map((e) => e.startedAt)
    .sort((a, b) => a - b)

  const gaps: { at: number; gap: number }[] = []
  for (let i = 1; i < starts.length; i++) {
    const gap = starts[i] - starts[i - 1]
    if (gap >= HOUR && gap <= 6 * HOUR) gaps.push({ at: starts[i], gap })
  }

  return dayStarts(now, days).map((day) => {
    const end = addDays(day, 1).getTime()
    const todays = gaps.filter((g) => g.at >= day && g.at < end)
    return {
      day,
      gapMs: todays.length
        ? todays.reduce((s, g) => s + g.gap, 0) / todays.length
        : null,
    }
  })
}

/** Average time between pump sessions since `since`. Gaps under 30 min or over 12 h are ignored. */
export function pumpGapMs(events: BabyEvent[], since: number): number | null {
  const starts = events
    .filter((e) => e.type === 'pump' && e.startedAt >= since)
    .map((e) => e.startedAt)
    .sort((a, b) => a - b)

  const gaps: number[] = []
  for (let i = 1; i < starts.length; i++) {
    const gap = starts[i] - starts[i - 1]
    if (gap >= 30 * MIN && gap <= 12 * HOUR) gaps.push(gap)
  }
  return gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : null
}

export interface Highlights {
  avgFeeds: number
  avgGapMs: number | null
  avgSleepMs: number
  avgMl: number
  longestSleepMs: number
  daysCounted: number
  /** breast pump: sessions and ml per day, ml and time per session, time between sessions */
  avgPumps: number
  avgPumpMl: number
  avgPumpSessionMl: number | null
  avgPumpMs: number | null
  avgPumpGapMs: number | null
}

/**
 * Averages over days that have data. Today is left out while other days exist,
 * because a half-finished day would drag the averages down.
 */
export function highlights(events: BabyEvent[], now: number, days: number): Highlights {
  const totals = dailyTotals(events, now, days)
  const today = startOfDay(now).getTime()
  const active = totals.filter(
    (t) => t.feeds > 0 || t.sleepMs > 0 || t.diapers > 0 || t.pumps > 0,
  )
  const complete = active.filter((t) => t.day !== today)
  const counted = complete.length > 0 ? complete : active
  const n = counted.length
  const sum = (pick: (t: DayTotals) => number) => counted.reduce((s, t) => s + pick(t), 0)
  const avg = (pick: (t: DayTotals) => number) => (n ? sum(pick) / n : 0)

  const countedDays = new Set(counted.map((t) => t.day))
  const gapDays = feedGapsByDay(events, now, days).filter(
    (g) => g.gapMs !== null && countedDays.has(g.day),
  )

  const first = dayStarts(now, days)[0]
  const longestSleepMs = events
    .filter((e) => e.type === 'sleep' && e.startedAt >= first)
    .reduce((max, e) => Math.max(max, (e.endedAt ?? now) - e.startedAt), 0)

  const pumpSessions = sum((t) => t.pumps)

  return {
    avgFeeds: avg((t) => t.feeds),
    avgGapMs: gapDays.length
      ? gapDays.reduce((s, g) => s + (g.gapMs ?? 0), 0) / gapDays.length
      : null,
    avgSleepMs: avg((t) => t.sleepMs),
    avgMl: avg((t) => t.ml),
    longestSleepMs,
    daysCounted: n,
    avgPumps: avg((t) => t.pumps),
    avgPumpMl: avg((t) => t.pumpMl),
    avgPumpSessionMl: pumpSessions ? sum((t) => t.pumpMl) / pumpSessions : null,
    avgPumpMs: pumpSessions ? sum((t) => t.pumpMs) / pumpSessions : null,
    avgPumpGapMs: pumpGapMs(events, first),
  }
}

export interface Segment {
  id: string
  type: EventType
  /** position within the day, 0..1 */
  from: number
  to: number
  startMs: number
  endMs: number
}

/** Blocks and diaper markers for a 24h timeline of `day`. */
export function timeline(events: BabyEvent[], day: number, now: number) {
  const end = addDays(day, 1).getTime()
  const span = end - day
  const segments: Segment[] = []
  const diapers: { id: string; at: number; ms: number }[] = []

  for (const e of events) {
    if (e.type === 'diaper') {
      if (e.startedAt >= day && e.startedAt < end) {
        diapers.push({ id: e.id, at: (e.startedAt - day) / span, ms: e.startedAt })
      }
      continue
    }
    const stop = e.endedAt ?? now
    if (overlapMs(e.startedAt, stop, day, end) <= 0) continue
    segments.push({
      id: e.id,
      type: e.type,
      from: (Math.max(e.startedAt, day) - day) / span,
      to: (Math.min(stop, end) - day) / span,
      startMs: e.startedAt,
      endMs: stop,
    })
  }
  return { segments, diapers }
}
