import { describe, expect, it } from 'vitest'
import type { BabyEvent, MilkBag } from '../types'
import {
  availableBags,
  bagStatus,
  discardedBags,
  expiry,
  splitVolume,
  stashSummary,
  storageByDay,
  storedBags,
  usedAtMap,
  usedBags,
} from './storage'

const DAY = 86_400_000
const at = (iso: string) => new Date(iso).getTime()
const NOW = at('2026-11-15T12:00:00')

const bag = (
  id: string,
  pumped: string,
  ml: number,
  location: MilkBag['location'] = 'freezer',
  extra: Partial<MilkBag> = {},
): MilkBag => ({ id, pumpedAt: at(pumped), volumeMl: ml, location, ...extra })

const feed = (id: string, start: string, bagIds?: string[]): BabyEvent => ({
  id,
  type: 'eat',
  startedAt: at(start),
  endedAt: at(start) + 15 * 60_000,
  details: bagIds ? { side: 'bottle', milk: 'pumped', bagIds } : { side: 'bottle', milk: 'formula' },
})

describe('which bags are used', () => {
  it('a bag is used by the feed that lists it, at that feed’s time', () => {
    const used = usedAtMap([feed('f1', '2026-11-14T10:00:00', ['a', 'b'])])
    expect(used.get('a')).toBe(at('2026-11-14T10:00:00'))
    expect(used.get('b')).toBe(at('2026-11-14T10:00:00'))
  })

  it('uses the earliest feed when two list the same bag', () => {
    const used = usedAtMap([
      feed('late', '2026-11-14T18:00:00', ['a']),
      feed('early', '2026-11-14T08:00:00', ['a']),
    ])
    expect(used.get('a')).toBe(at('2026-11-14T08:00:00'))
  })

  it('formula feeds and other entries use no bags', () => {
    expect(usedAtMap([feed('f', '2026-11-14T10:00:00')]).size).toBe(0)
  })

  it('has a status of stored, used or discarded, and used wins', () => {
    const used = new Map([['u', 1]])
    expect(bagStatus(bag('s', '2026-11-14T08:00:00', 100), used)).toBe('stored')
    expect(bagStatus(bag('u', '2026-11-14T08:00:00', 100), used)).toBe('used')
    expect(bagStatus(bag('d', '2026-11-14T08:00:00', 100, 'freezer', { discardedAt: 5 }), used)).toBe('discarded')
    expect(bagStatus(bag('u', '2026-11-14T08:00:00', 100, 'freezer', { discardedAt: 5 }), used)).toBe('used')
  })
})

describe('storedBags', () => {
  const bags = [
    bag('old', '2026-11-10T08:00:00', 100),
    bag('new', '2026-11-14T22:00:00', 120),
    bag('mid', '2026-11-12T08:00:00', 110),
    bag('used', '2026-11-13T08:00:00', 90),
    bag('trash', '2026-11-11T08:00:00', 80, 'fridge', { discardedAt: at('2026-11-13T09:00:00') }),
  ]
  const events = [feed('f', '2026-11-14T10:00:00', ['used'])]

  it('lists only bags still in storage, newest first', () => {
    expect(storedBags(bags, events).map((b) => b.id)).toEqual(['new', 'mid', 'old'])
  })

  it('puts a bag back when the feed that used it is deleted or cancelled', () => {
    expect(storedBags(bags, []).map((b) => b.id)).toContain('used')
  })

  it('offers a feed its own bags again when editing it', () => {
    expect(availableBags(bags, events).map((b) => b.id)).not.toContain('used')
    expect(availableBags(bags, events, 'f').map((b) => b.id)).toContain('used')
  })

  it('lists used bags with when they were used, and thrown-away bags separately', () => {
    expect(usedBags(bags, events)).toEqual([{ bag: bags[3], usedAt: at('2026-11-14T10:00:00') }])
    expect(discardedBags(bags, events).map((b) => b.id)).toEqual(['trash'])
  })
})

describe('expiry', () => {
  it('uses about 4 days in the fridge and 6 months in the freezer', () => {
    const f = expiry(bag('f', '2026-11-14T12:00:00', 100, 'fridge'), NOW)
    expect(f.useBy).toBe(at('2026-11-14T12:00:00') + 4 * DAY)
    const z = expiry(bag('z', '2026-11-14T12:00:00', 100, 'freezer'), NOW)
    expect(z.useBy).toBe(at('2026-11-14T12:00:00') + 180 * DAY)
  })

  it('flags use-soon within a day for the fridge and two weeks for the freezer', () => {
    // pumped 11:00 on the 12th: use-by is 11:00 on the 16th, 23 hours from NOW (noon on the 15th)
    expect(expiry(bag('f', '2026-11-12T11:00:00', 100, 'fridge'), NOW).state).toBe('soon')
    expect(expiry(bag('f', '2026-11-14T12:00:00', 100, 'fridge'), NOW).state).toBe('ok')
    expect(expiry(bag('z', '2026-05-30T12:00:00', 100, 'freezer'), NOW).state).toBe('soon')
    expect(expiry(bag('z', '2026-11-01T12:00:00', 100, 'freezer'), NOW).state).toBe('ok')
  })

  it('marks a bag past its use-by time as expired', () => {
    const e = expiry(bag('f', '2026-11-09T12:00:00', 100, 'fridge'), NOW)
    expect(e.state).toBe('expired')
    expect(e.daysLeft).toBeLessThanOrEqual(0)
  })
})

describe('stashSummary', () => {
  it('counts bags and ml by location and finds the one to use first', () => {
    const bags = [
      bag('a', '2026-11-14T08:00:00', 120, 'freezer'),
      bag('b', '2026-11-15T07:00:00', 100, 'fridge'),
      bag('c', '2026-11-10T08:00:00', 90, 'freezer'),
      bag('used', '2026-11-13T08:00:00', 80, 'freezer'),
    ]
    const s = stashSummary(bags, [feed('f', '2026-11-14T10:00:00', ['used'])], NOW)
    expect(s).toMatchObject({
      bags: 3,
      ml: 310,
      fridge: { bags: 1, ml: 100 },
      freezer: { bags: 2, ml: 210 },
    })
    expect(s.nextUseBy?.bag.id).toBe('b') // the fridge bag runs out first
  })

  it('is empty with no bags', () => {
    expect(stashSummary([], [], NOW)).toMatchObject({ bags: 0, ml: 0 })
    expect(stashSummary([], [], NOW).nextUseBy).toBeUndefined()
  })
})

describe('splitVolume', () => {
  it('splits into whole millilitres that add up to the total', () => {
    expect(splitVolume(120, 2)).toEqual([60, 60])
    expect(splitVolume(125, 2)).toEqual([63, 62])
    expect(splitVolume(100, 3)).toEqual([34, 33, 33])
    expect(splitVolume(100, 3).reduce((s, n) => s + n, 0)).toBe(100)
    expect(splitVolume(80, 1)).toEqual([80])
    expect(splitVolume(80, 0)).toEqual([80])
  })
})

describe('storageByDay', () => {
  it('tracks the stash level and what was stored, used and thrown away each day', () => {
    const bags = [
      bag('a', '2026-11-13T08:00:00', 100), // stored day 1, used day 2
      bag('b', '2026-11-13T20:00:00', 120), // stored day 1, still there
      bag('c', '2026-11-14T09:00:00', 90, 'freezer', { discardedAt: at('2026-11-15T07:00:00') }), // stored day 2, thrown away day 3
    ]
    const events = [feed('f', '2026-11-14T10:00:00', ['a'])]
    const [d13, d14, d15] = storageByDay(bags, events, NOW, 3)

    expect(d13).toMatchObject({ stashMl: 220, storedMl: 220, usedMl: 0, discardedMl: 0 })
    expect(d14).toMatchObject({ stashMl: 210, storedMl: 90, usedMl: 100, discardedMl: 0 }) // b + c
    expect(d15).toMatchObject({ stashMl: 120, storedMl: 0, usedMl: 0, discardedMl: 90 }) // only b
  })

  it('measures today up to now, not up to midnight', () => {
    const bags = [bag('late', '2026-11-15T18:00:00', 100)] // later today than NOW
    const [today] = storageByDay(bags, [], NOW, 1)
    expect(today.stashMl).toBe(0)
  })

  it('puts a used bag back in the past figures if its feed disappears', () => {
    const bags = [bag('a', '2026-11-13T08:00:00', 100)]
    const [, d14] = storageByDay(bags, [], NOW, 3)
    expect(d14.stashMl).toBe(100)
  })
})
