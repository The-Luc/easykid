import { describe, expect, it } from 'vitest'
import type { BabyEvent } from '../types'
import { dailyTotals, feedGapsByDay, highlights, timeline } from './stats'

const HOUR = 3_600_000
const at = (iso: string) => new Date(iso).getTime()

const ev = (
  id: string,
  type: BabyEvent['type'],
  start: string,
  end: string | null,
  details: BabyEvent['details'] = {},
): BabyEvent => ({
  id,
  type,
  startedAt: at(start),
  endedAt: end === null ? null : at(end),
  details,
})

describe('dailyTotals', () => {
  it('splits overnight sleep across both days', () => {
    const now = at('2026-11-15T12:00:00')
    const events = [ev('s', 'sleep', '2026-11-14T23:00:00', '2026-11-15T01:00:00')]
    const [d14, d15] = dailyTotals(events, now, 2)
    expect(d14.sleepMs).toBe(1 * HOUR)
    expect(d15.sleepMs).toBe(1 * HOUR)
  })

  it('counts feeds, bottle ml and diapers on the day they started', () => {
    const now = at('2026-11-14T20:00:00')
    const events = [
      ev('a', 'eat', '2026-11-14T08:00:00', '2026-11-14T08:15:00', { side: 'bottle', ml: 90 }),
      ev('b', 'eat', '2026-11-14T11:00:00', '2026-11-14T11:15:00', { side: 'left' }),
      ev('c', 'diaper', '2026-11-14T09:00:00', '2026-11-14T09:00:00', { diaper: 'wet' }),
    ]
    const [today] = dailyTotals(events, now, 1)
    expect(today).toMatchObject({ feeds: 2, ml: 90, diapers: 1 })
  })
})

describe('feedGapsByDay', () => {
  it('averages gaps by the day of the later feed', () => {
    const now = at('2026-11-14T20:00:00')
    const events = [
      ev('a', 'eat', '2026-11-14T08:00:00', null),
      ev('b', 'eat', '2026-11-14T11:00:00', null),
      ev('c', 'eat', '2026-11-14T15:00:00', null),
    ]
    const [today] = feedGapsByDay(events, now, 1)
    expect(today.gapMs).toBe(3.5 * HOUR)
  })

  it('returns null when a day has no gaps', () => {
    const now = at('2026-11-14T20:00:00')
    expect(feedGapsByDay([], now, 1)[0].gapMs).toBeNull()
  })
})

describe('highlights', () => {
  it('leaves out today while a complete earlier day exists', () => {
    const now = at('2026-11-14T12:00:00')
    const events = [
      ev('a', 'eat', '2026-11-13T08:00:00', '2026-11-13T08:20:00'),
      ev('b', 'eat', '2026-11-13T11:00:00', '2026-11-13T11:20:00'),
      ev('c', 'eat', '2026-11-13T14:00:00', '2026-11-13T14:20:00'),
      ev('s', 'sleep', '2026-11-13T15:00:00', '2026-11-13T17:00:00'),
      ev('t', 'eat', '2026-11-14T08:00:00', '2026-11-14T08:20:00'),
    ]
    const h = highlights(events, now, 7)
    expect(h.daysCounted).toBe(1)
    expect(h.avgFeeds).toBe(3)
    expect(h.avgSleepMs).toBe(2 * HOUR)
    expect(h.avgGapMs).toBe(3 * HOUR)
    expect(h.longestSleepMs).toBe(2 * HOUR)
  })

  it('uses today when it is the only day with data', () => {
    const now = at('2026-11-14T12:00:00')
    const events = [ev('t', 'eat', '2026-11-14T08:00:00', '2026-11-14T08:20:00')]
    expect(highlights(events, now, 7)).toMatchObject({ daysCounted: 1, avgFeeds: 1 })
  })

  it('handles an empty log', () => {
    expect(highlights([], Date.now(), 7)).toMatchObject({
      daysCounted: 0,
      avgFeeds: 0,
      avgGapMs: null,
    })
  })
})

describe('timeline', () => {
  it('positions blocks as fractions of the day', () => {
    const day = at('2026-11-14T00:00:00')
    const events = [
      ev('s', 'sleep', '2026-11-14T06:00:00', '2026-11-14T12:00:00'),
      ev('d', 'diaper', '2026-11-14T18:00:00', '2026-11-14T18:00:00'),
    ]
    const { segments, diapers } = timeline(events, day, at('2026-11-14T20:00:00'))
    expect(segments).toHaveLength(1)
    expect(segments[0].from).toBeCloseTo(0.25)
    expect(segments[0].to).toBeCloseTo(0.5)
    expect(diapers[0].at).toBeCloseTo(0.75)
  })

  it('clips a sleep that started the previous evening', () => {
    const day = at('2026-11-15T00:00:00')
    const events = [ev('s', 'sleep', '2026-11-14T22:00:00', '2026-11-15T06:00:00')]
    const { segments } = timeline(events, day, at('2026-11-15T20:00:00'))
    expect(segments[0].from).toBe(0)
    expect(segments[0].to).toBeCloseTo(0.25)
  })
})
