import type { BabyEvent } from '../types'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export interface FeedPrediction {
  /** epoch ms of the likely next feed */
  at: number
  gapMs: number
  basis: 'average' | 'default'
  /** number of gaps the average is based on (0 for defaults) */
  samples: number
}

/** Typical E.A.S.Y. cycle length by age (Baby Whisperer guidance). */
export function defaultFeedGapMs(ageWeeks: number): number {
  if (ageWeeks < 6) return 2.5 * HOUR
  if (ageWeeks < 12) return 3 * HOUR
  return 3.5 * HOUR
}

/**
 * Average time between feed starts over the last 3 days.
 * Gaps outside 1h–6h are ignored (cluster feeds, long gaps). Needs 2+ gaps.
 */
export function averageFeedGap(
  events: BabyEvent[],
  now: number,
): { gapMs: number; samples: number } | null {
  const starts = events
    .filter((e) => e.type === 'eat' && e.startedAt >= now - 3 * DAY)
    .map((e) => e.startedAt)
    .sort((a, b) => a - b)

  const gaps: number[] = []
  for (let i = 1; i < starts.length; i++) {
    const gap = starts[i] - starts[i - 1]
    if (gap >= HOUR && gap <= 6 * HOUR) gaps.push(gap)
  }

  const recent = gaps.slice(-8)
  if (recent.length < 2) return null
  const gapMs = recent.reduce((sum, g) => sum + g, 0) / recent.length
  return { gapMs, samples: recent.length }
}

/** Predict the next feed. Returns null until at least one feed is logged. */
export function predictNextFeed(
  events: BabyEvent[],
  now: number,
  ageWeeks = 2,
): FeedPrediction | null {
  const last = events
    .filter((e) => e.type === 'eat')
    .sort((a, b) => b.startedAt - a.startedAt)[0]
  if (!last) return null

  const avg = averageFeedGap(events, now)
  if (avg) {
    return {
      at: last.startedAt + avg.gapMs,
      gapMs: avg.gapMs,
      basis: 'average',
      samples: avg.samples,
    }
  }
  const gapMs = defaultFeedGapMs(ageWeeks)
  return { at: last.startedAt + gapMs, gapMs, basis: 'default', samples: 0 }
}
