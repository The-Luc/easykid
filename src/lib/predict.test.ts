import { describe, expect, it } from 'vitest'
import type { BabyEvent } from '../types'
import { averageFeedGap, defaultFeedGapMs, predictNextFeed } from './predict'

const HOUR = 3_600_000
const NOW = new Date('2026-11-14T15:00:00').getTime()

const feed = (startedAt: number): BabyEvent => ({
  id: String(startedAt),
  type: 'eat',
  startedAt,
  endedAt: startedAt + 20 * 60_000,
  details: {},
})

describe('defaultFeedGapMs', () => {
  it('grows with age', () => {
    expect(defaultFeedGapMs(1)).toBe(2.5 * HOUR)
    expect(defaultFeedGapMs(8)).toBe(3 * HOUR)
    expect(defaultFeedGapMs(16)).toBe(3.5 * HOUR)
  })
})

describe('predictNextFeed', () => {
  it('returns null with no feeds logged', () => {
    expect(predictNextFeed([], NOW)).toBeNull()
  })

  it('falls back to the age default with too little history', () => {
    const p = predictNextFeed([feed(NOW - HOUR)], NOW, 2)
    expect(p?.basis).toBe('default')
    expect(p?.at).toBe(NOW - HOUR + 2.5 * HOUR)
  })

  it('uses the recent average gap when there is enough history', () => {
    const events = [feed(NOW - 9 * HOUR), feed(NOW - 6 * HOUR), feed(NOW - 3 * HOUR)]
    const p = predictNextFeed(events, NOW)
    expect(p?.basis).toBe('average')
    expect(p?.samples).toBe(2)
    expect(p?.gapMs).toBe(3 * HOUR)
    expect(p?.at).toBe(NOW)
  })

  it('anchors on the most recent feed', () => {
    const events = [feed(NOW - 6 * HOUR), feed(NOW - 3 * HOUR), feed(NOW - HOUR)]
    const p = predictNextFeed(events, NOW)
    expect(p?.at).toBe(NOW - HOUR + p!.gapMs)
  })
})

describe('averageFeedGap', () => {
  it('ignores gaps over 6 hours and feeds older than 3 days', () => {
    const events = [
      feed(NOW - 80 * HOUR),
      feed(NOW - 20 * HOUR),
      feed(NOW - 10 * HOUR),
      feed(NOW - 7 * HOUR),
      feed(NOW - 4 * HOUR),
    ]
    const avg = averageFeedGap(events, NOW)
    // -80h is outside 3 days; the 10h gap is over 6h; the two 3h gaps remain
    expect(avg?.samples).toBe(2)
    expect(avg?.gapMs).toBe(3 * HOUR)
  })
})
