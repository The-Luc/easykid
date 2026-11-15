import { describe, expect, it } from 'vitest'
import type { BabyEvent } from '../types'
import {
  cancelPhase,
  daySummary,
  eventsOnDay,
  getOpenPhase,
  lastPumpMl,
  startPhase,
  stopPhase,
} from './events'

const T = new Date('2026-11-14T10:00:00').getTime()
const MIN = 60_000

const mk = (
  id: string,
  type: BabyEvent['type'],
  startedAt: number,
  endedAt: number | null,
): BabyEvent => ({ id, type, startedAt, endedAt, details: {} })

describe('startPhase', () => {
  it('starts a phase from an empty log', () => {
    const next = startPhase([], 'eat', T, 'a')
    expect(next).toHaveLength(1)
    expect(getOpenPhase(next)?.type).toBe('eat')
  })

  it('ends the running phase when another starts', () => {
    const first = startPhase([], 'eat', T, 'a')
    const next = startPhase(first, 'sleep', T + 20 * MIN, 'b')
    expect(next.find((e) => e.id === 'a')?.endedAt).toBe(T + 20 * MIN)
    expect(getOpenPhase(next)?.id).toBe('b')
  })

  it('does not create an activity between a feed and a sleep (activity is calculated)', () => {
    const afterFeed = stopPhase(startPhase([], 'eat', T, 'a'), T + 15 * MIN)
    const next = startPhase(afterFeed, 'sleep', T + 45 * MIN, 'c')
    expect(next.map((e) => e.type)).toEqual(['eat', 'sleep'])
  })

  it('does nothing when the same phase is already running', () => {
    const first = startPhase([], 'sleep', T, 'a')
    expect(startPhase(first, 'sleep', T + MIN, 'b')).toBe(first)
  })
})

describe('stopPhase', () => {
  it('ends a feed and keeps it, without starting anything else', () => {
    const running = startPhase([], 'eat', T, 'a')
    const next = stopPhase(running, T + 15 * MIN)
    expect(next).toHaveLength(1)
    expect(next[0].endedAt).toBe(T + 15 * MIN)
    expect(getOpenPhase(next)).toBeUndefined()
  })

  it('ends sleep', () => {
    const next = stopPhase(startPhase([], 'sleep', T, 'a'), T + 60 * MIN)
    expect(next[0].endedAt).toBe(T + 60 * MIN)
  })

  it('returns the same list when nothing is running', () => {
    const idle: BabyEvent[] = [mk('x', 'eat', T, T + MIN)]
    expect(stopPhase(idle, T + 5 * MIN)).toBe(idle)
  })
})

describe('cancelPhase', () => {
  it('discards the running timer completely', () => {
    const running = startPhase([], 'eat', T, 'a')
    expect(cancelPhase(running)).toEqual([])
  })

  it('keeps finished entries and only removes the running one', () => {
    const events = [mk('done', 'eat', T - 60 * MIN, T - 45 * MIN), mk('run', 'sleep', T, null)]
    expect(cancelPhase(events).map((e) => e.id)).toEqual(['done'])
  })

  it('does nothing when no timer is running', () => {
    const idle: BabyEvent[] = [mk('x', 'eat', T, T + MIN)]
    expect(cancelPhase(idle)).toBe(idle)
  })

  it('never touches diapers', () => {
    const events = [mk('d', 'diaper', T, T), mk('run', 'eat', T, null)]
    expect(cancelPhase(events).map((e) => e.id)).toEqual(['d'])
  })
})

describe('getOpenPhase', () => {
  it('ignores diapers', () => {
    expect(getOpenPhase([mk('d', 'diaper', T, null)])).toBeUndefined()
  })
})

describe('eventsOnDay', () => {
  it('returns only that day, newest first', () => {
    const events = [
      mk('old', 'eat', T - 24 * 60 * MIN, T - 24 * 60 * MIN),
      mk('early', 'eat', T - 60 * MIN, T - 60 * MIN),
      mk('late', 'eat', T, T),
    ]
    expect(eventsOnDay(events, T).map((e) => e.id)).toEqual(['late', 'early'])
  })
})

describe('daySummary', () => {
  it('counts feeds and diapers, and sums sleep including a running nap', () => {
    const now = T + 5 * 60 * MIN
    const events = [
      mk('e1', 'eat', T - 60 * MIN, T - 45 * MIN),
      mk('e2', 'eat', T, T + 20 * MIN),
      mk('d1', 'diaper', T + MIN, T + MIN),
      mk('s1', 'sleep', T + 30 * MIN, T + 90 * MIN), // 60 min
      mk('s2', 'sleep', now - 30 * MIN, null), // running, 30 min so far
    ]
    expect(daySummary(events, T, now)).toEqual({
      feeds: 2,
      diapers: 1,
      sleepMs: 90 * MIN,
      pumps: 0,
      pumpMl: 0,
    })
  })
})

describe('pump entries', () => {
  const pump = (id: string, start: number, ml?: number): BabyEvent => ({
    id,
    type: 'pump',
    startedAt: start,
    endedAt: start + 20 * MIN,
    details: ml ? { side: 'both', ml } : { side: 'both' },
  })

  it('is not a phase, so it never counts as a running timer', () => {
    expect(getOpenPhase([mk('p', 'pump', T, null)])).toBeUndefined()
  })

  it('does not interfere with the eat and sleep timers', () => {
    const running = startPhase([pump('p', T - 30 * MIN, 100)], 'sleep', T, 'a')
    expect(running.map((e) => e.id)).toEqual(['p', 'a'])
    expect(stopPhase(running, T + MIN).find((e) => e.id === 'p')?.endedAt).toBe(T - 10 * MIN)
  })

  it('adds the sessions and amount pumped to the day summary', () => {
    const events = [pump('a', T - 120 * MIN, 90), pump('b', T, 120), pump('c', T + 60 * MIN)]
    const s = daySummary(events, T, T + 3 * 60 * MIN)
    expect(s.pumps).toBe(3)
    expect(s.pumpMl).toBe(210) // a session without an amount adds nothing
  })

  it('finds the amount of the most recent session that recorded one', () => {
    const events = [pump('old', T - 300 * MIN, 80), pump('new', T, 130), pump('none', T + 60 * MIN)]
    expect(lastPumpMl(events)).toBe(130)
    expect(lastPumpMl([])).toBeUndefined()
  })
})
