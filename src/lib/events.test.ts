import { describe, expect, it } from 'vitest'
import type { BabyEvent } from '../types'
import {
  daySummary,
  eventsOnDay,
  getOpenPhase,
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

  it('ends the auto-started activity when sleep starts', () => {
    const afterFeed = stopPhase(startPhase([], 'eat', T, 'a'), T + 15 * MIN, 'b')
    const next = startPhase(afterFeed, 'sleep', T + 45 * MIN, 'c')
    expect(next.find((e) => e.id === 'b')?.endedAt).toBe(T + 45 * MIN)
    expect(getOpenPhase(next)?.type).toBe('sleep')
  })

  it('does nothing when the same phase is already running', () => {
    const first = startPhase([], 'sleep', T, 'a')
    expect(startPhase(first, 'sleep', T + MIN, 'b')).toBe(first)
  })
})

describe('stopPhase', () => {
  it('ends a feed and auto-starts activity', () => {
    const running = startPhase([], 'eat', T, 'a')
    const next = stopPhase(running, T + 15 * MIN, 'b')
    expect(next.find((e) => e.id === 'a')?.endedAt).toBe(T + 15 * MIN)
    const open = getOpenPhase(next)
    expect(open?.type).toBe('activity')
    expect(open?.startedAt).toBe(T + 15 * MIN)
  })

  it('does not start anything after sleep', () => {
    const running = startPhase([], 'sleep', T, 'a')
    const next = stopPhase(running, T + 60 * MIN, 'b')
    expect(getOpenPhase(next)).toBeUndefined()
    expect(next).toHaveLength(1)
  })

  it('does nothing when idle', () => {
    expect(stopPhase([], T, 'x')).toEqual([])
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
    })
  })
})
