import { describe, expect, it } from 'vitest'
import type { BabyEvent } from '../types'
import { awakeSince, derivedActivity, isDerived, withDerived } from './awake'

const T = new Date('2026-11-14T09:00:00').getTime()
const MIN = 60_000
const at = (minutes: number) => T + minutes * MIN // minutes after 09:00

const mk = (
  id: string,
  type: BabyEvent['type'],
  start: number,
  end: number | null,
): BabyEvent => ({ id, type, startedAt: start, endedAt: end, details: {} })

describe('derivedActivity', () => {
  it('fills the awake time between the end of a feed and the next sleep', () => {
    const events = [mk('eat1', 'eat', at(0), at(20)), mk('s1', 'sleep', at(60), at(120))]
    const [a] = derivedActivity(events, at(200))
    expect(derivedActivity(events, at(200))).toHaveLength(1)
    expect(a).toMatchObject({
      id: 'auto:eat1',
      type: 'activity',
      startedAt: at(20),
      endedAt: at(60),
    })
  })

  it('stops at the next feed when no sleep was logged in between', () => {
    const events = [mk('eat1', 'eat', at(0), at(20)), mk('eat2', 'eat', at(60), at(75))]
    const out = derivedActivity(events, at(150))
    expect(out.map((a) => [a.id, a.startedAt, a.endedAt])).toEqual([
      ['auto:eat1', at(20), at(60)],
      ['auto:eat2', at(75), null], // nothing after the second feed yet: still awake
    ])
  })

  it('leaves the window open while the baby is still awake', () => {
    const [a] = derivedActivity([mk('eat1', 'eat', at(0), at(20))], at(50))
    expect(a.endedAt).toBeNull()
    expect(a.startedAt).toBe(at(20))
  })

  it('ignores windows under a minute and over four hours', () => {
    const tiny = [mk('e', 'eat', at(0), at(20)), mk('s', 'sleep', at(20) + 30_000, at(80))]
    expect(derivedActivity(tiny, at(100))).toEqual([])

    const huge = [mk('e', 'eat', at(0), at(20))]
    expect(derivedActivity(huge, at(20 + 5 * 60))).toEqual([]) // 5 hours later
  })

  it('ignores windows shorter than five minutes but keeps five', () => {
    const quick = [mk('e', 'eat', at(0), at(20)), mk('s', 'sleep', at(24), at(80))]
    expect(derivedActivity(quick, at(100))).toEqual([]) // 4 minutes

    const exact = [mk('e', 'eat', at(0), at(20)), mk('s', 'sleep', at(25), at(80))]
    expect(derivedActivity(exact, at(100))).toHaveLength(1) // 5 minutes
  })

  it('does not invent an activity while a sleep that started before the feed ended is running', () => {
    // the feed was recorded as ending a minute after the sleep began
    const events = [mk('eat1', 'eat', at(0), at(21)), mk('s1', 'sleep', at(20), null)]
    expect(derivedActivity(events, at(40))).toEqual([])
  })

  it('does not invent an activity when a sleep overlaps the end of the feed', () => {
    const events = [mk('eat1', 'eat', at(10), at(30)), mk('s1', 'sleep', at(0), at(60))]
    expect(derivedActivity(events, at(100))).toEqual([])
  })

  it('is not blocked by a sleep that finished before the feed', () => {
    const events = [mk('old', 'sleep', at(-180), at(-120)), mk('eat1', 'eat', at(0), at(20))]
    const [a] = derivedActivity(events, at(50))
    expect(a).toMatchObject({ id: 'auto:eat1', startedAt: at(20), endedAt: null })
  })

  it('lets an activity you logged yourself win inside the window', () => {
    const events = [
      mk('eat1', 'eat', at(0), at(20)),
      mk('manual', 'activity', at(30), at(50)),
      mk('s1', 'sleep', at(60), at(120)),
    ]
    expect(derivedActivity(events, at(200))).toEqual([])
  })

  it('is not suppressed by an activity logged outside the window', () => {
    const events = [
      mk('early', 'activity', at(-120), at(-90)),
      mk('eat1', 'eat', at(0), at(20)),
      mk('s1', 'sleep', at(60), at(120)),
    ]
    expect(derivedActivity(events, at(200))).toHaveLength(1)
  })

  it('does nothing while a feed is still running', () => {
    expect(derivedActivity([mk('eat1', 'eat', at(0), null)], at(10))).toEqual([])
  })

  it('ignores diapers', () => {
    const events = [
      mk('eat1', 'eat', at(0), at(20)),
      mk('d', 'diaper', at(30), at(30)),
      mk('s1', 'sleep', at(60), at(120)),
    ]
    expect(derivedActivity(events, at(200))[0].endedAt).toBe(at(60))
  })

  it('never produces an id that could collide with a real record', () => {
    const [a] = derivedActivity([mk('eat1', 'eat', at(0), at(20))], at(40))
    expect(isDerived(a)).toBe(true)
    expect(isDerived(mk('plain-id', 'eat', 0, 1))).toBe(false)
  })
})

describe('withDerived', () => {
  it('adds calculated entries without changing the real ones', () => {
    const real = [mk('eat1', 'eat', at(0), at(20))]
    const all = withDerived(real, at(40))
    expect(all).toHaveLength(2)
    expect(all[0]).toBe(real[0])
    expect(real).toHaveLength(1)
  })
})

describe('awakeSince', () => {
  it('is undefined with no entries', () => {
    expect(awakeSince([], at(10))).toBeUndefined()
  })

  it('counts from the end of the last feed', () => {
    expect(awakeSince([mk('e', 'eat', at(0), at(20))], at(45))).toBe(at(20))
  })

  it('counts from the end of the last sleep (wake-up)', () => {
    const events = [mk('e', 'eat', at(0), at(20)), mk('s', 'sleep', at(30), at(90))]
    expect(awakeSince(events, at(100))).toBe(at(90))
  })

  it('is undefined while something is running', () => {
    expect(awakeSince([mk('s', 'sleep', at(0), null)], at(10))).toBeUndefined()
  })

  it('is undefined once it has been more than four hours', () => {
    expect(awakeSince([mk('e', 'eat', at(0), at(20))], at(20 + 5 * 60))).toBeUndefined()
  })

  it('is not moved by diapers or manual activity', () => {
    const events = [
      mk('e', 'eat', at(0), at(20)),
      mk('d', 'diaper', at(30), at(30)),
      mk('a', 'activity', at(25), at(40)),
    ]
    expect(awakeSince(events, at(50))).toBe(at(20))
  })
})
