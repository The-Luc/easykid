import { addDays } from 'date-fns'
import type { BabyEvent, MilkBag } from '../types'
import { dayStarts } from './stats'

/*
 * Milk storage. A bag is "used" when a feed lists it in `details.bagIds`, and its used
 * time is that feed's start. Nothing about use is stored on the bag, so cancelling or
 * deleting a feed puts the bag back into storage by itself, and the numbers can never
 * disagree with the feeding log.
 */

const DAY = 86_400_000

/** General storage guidance: about 4 days in the fridge, about 6 months in the freezer. */
export const SHELF_LIFE_DAYS = { fridge: 4, freezer: 180 } as const
/** A bag is flagged "use soon" this long before its use-by time. */
const SOON_MS = { fridge: DAY, freezer: 14 * DAY } as const

/** bag id → when it was used (the start of the earliest feed that lists it) */
export function usedAtMap(events: BabyEvent[]): Map<string, number> {
  const used = new Map<string, number>()
  for (const e of events) {
    if (e.type !== 'eat' || !e.details.bagIds) continue
    for (const id of e.details.bagIds) {
      const prev = used.get(id)
      if (prev === undefined || e.startedAt < prev) used.set(id, e.startedAt)
    }
  }
  return used
}

export type BagStatus = 'stored' | 'used' | 'discarded'

export function bagStatus(bag: MilkBag, used: Map<string, number>): BagStatus {
  if (used.has(bag.id)) return 'used'
  return bag.discardedAt !== undefined ? 'discarded' : 'stored'
}

const newestFirst = (a: MilkBag, b: MilkBag) => b.pumpedAt - a.pumpedAt

/** Bags still in storage, newest first. */
export function storedBags(bags: MilkBag[], events: BabyEvent[]): MilkBag[] {
  const used = usedAtMap(events)
  return bags.filter((b) => bagStatus(b, used) === 'stored').sort(newestFirst)
}

/**
 * Bags that can be picked for a feed, newest first. When editing a feed, its own bags
 * are included (they are "used" only by it), so they stay ticked and can be unticked.
 */
export function availableBags(
  bags: MilkBag[],
  events: BabyEvent[],
  forEventId?: string,
): MilkBag[] {
  return storedBags(
    bags,
    forEventId ? events.filter((e) => e.id !== forEventId) : events,
  )
}

/** Bags already taken out, most recently used first, each with the time it was used. */
export function usedBags(bags: MilkBag[], events: BabyEvent[]) {
  const used = usedAtMap(events)
  return bags
    .filter((b) => used.has(b.id))
    .map((bag) => ({ bag, usedAt: used.get(bag.id) as number }))
    .sort((a, b) => b.usedAt - a.usedAt)
}

export function discardedBags(bags: MilkBag[], events: BabyEvent[]): MilkBag[] {
  const used = usedAtMap(events)
  return bags
    .filter((b) => bagStatus(b, used) === 'discarded')
    .sort((a, b) => (b.discardedAt ?? 0) - (a.discardedAt ?? 0))
}

export type ExpiryState = 'ok' | 'soon' | 'expired'

export function expiry(bag: MilkBag, now: number) {
  const useBy = bag.pumpedAt + SHELF_LIFE_DAYS[bag.location] * DAY
  const left = useBy - now
  const state: ExpiryState =
    left <= 0 ? 'expired' : left <= SOON_MS[bag.location] ? 'soon' : 'ok'
  return { useBy, state, daysLeft: Math.ceil(left / DAY) }
}

export interface StashSummary {
  bags: number
  ml: number
  fridge: { bags: number; ml: number }
  freezer: { bags: number; ml: number }
  /** the stored bag with the earliest use-by time (it may already be expired) */
  nextUseBy?: { at: number; bag: MilkBag }
}

export function stashSummary(bags: MilkBag[], events: BabyEvent[], now: number): StashSummary {
  const stored = storedBags(bags, events)
  const s: StashSummary = {
    bags: stored.length,
    ml: 0,
    fridge: { bags: 0, ml: 0 },
    freezer: { bags: 0, ml: 0 },
  }
  for (const b of stored) {
    s.ml += b.volumeMl
    s[b.location].bags += 1
    s[b.location].ml += b.volumeMl
    const { useBy } = expiry(b, now)
    if (!s.nextUseBy || useBy < s.nextUseBy.at) s.nextUseBy = { at: useBy, bag: b }
  }
  return s
}

/** Total ml of the bags with these ids (ids that no longer exist add nothing). */
export function volumeOf(bags: MilkBag[], ids: string[]): number {
  return bags.filter((b) => ids.includes(b.id)).reduce((sum, b) => sum + b.volumeMl, 0)
}

/** Split a pumped amount into `parts` bags of whole millilitres that add up to the total. */
export function splitVolume(totalMl: number, parts: number): number[] {
  const n = Math.max(1, Math.round(parts))
  const base = Math.floor(totalMl / n)
  const extra = totalMl - base * n
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0))
}

export interface StorageDay {
  day: number
  /** ml in storage at the end of the day (or right now, for today) */
  stashMl: number
  /** ml put into storage that day */
  storedMl: number
  /** ml taken out to feed that day */
  usedMl: number
  /** ml thrown away that day */
  discardedMl: number
}

/** Per-day storage figures for the last `days` days, oldest first. */
export function storageByDay(
  bags: MilkBag[],
  events: BabyEvent[],
  now: number,
  days: number,
): StorageDay[] {
  const used = usedAtMap(events)

  return dayStarts(now, days).map((day) => {
    const end = addDays(day, 1).getTime()
    const at = Math.min(end - 1, now) // the moment the stash is measured
    const inDay = (t: number | undefined) => t !== undefined && t >= day && t < end
    const row: StorageDay = { day, stashMl: 0, storedMl: 0, usedMl: 0, discardedMl: 0 }

    for (const b of bags) {
      const usedAt = used.get(b.id)
      if (inDay(b.pumpedAt)) row.storedMl += b.volumeMl
      if (inDay(usedAt)) row.usedMl += b.volumeMl
      else if (usedAt === undefined && inDay(b.discardedAt)) row.discardedMl += b.volumeMl

      const gone = (usedAt !== undefined && usedAt <= at) || (b.discardedAt !== undefined && b.discardedAt <= at)
      if (b.pumpedAt <= at && !gone) row.stashMl += b.volumeMl
    }
    return row
  })
}
