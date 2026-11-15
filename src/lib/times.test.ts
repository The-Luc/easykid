import { describe, expect, it } from 'vitest'
import { clampDuration, resolveSpan, switchAnchor } from './times'

const MIN = 60_000
const T = new Date('2026-11-14T10:20:00').getTime() // 10:20
const at = (minutes: number) => T + minutes * MIN // minutes after 10:20

describe('resolveSpan', () => {
  it('keeps the start fixed and calculates the end', () => {
    expect(resolveSpan('start', at(0), 15 * MIN)).toEqual({ startedAt: at(0), endedAt: at(15) })
  })

  it('keeps the end fixed and calculates the start', () => {
    expect(resolveSpan('end', at(15), 15 * MIN)).toEqual({ startedAt: at(0), endedAt: at(15) })
  })

  it('changing the duration moves only the calculated time', () => {
    // start anchored: the end moves, the start does not
    expect(resolveSpan('start', at(0), 20 * MIN)).toEqual({ startedAt: at(0), endedAt: at(20) })
    // end anchored: the start moves, the end does not
    expect(resolveSpan('end', at(15), 20 * MIN)).toEqual({ startedAt: at(-5), endedAt: at(15) })
  })
})

describe('switchAnchor', () => {
  it('shows the same entry from the other end', () => {
    const entry = resolveSpan('start', at(0), 15 * MIN)
    const endTime = switchAnchor('start', at(0), 15 * MIN)
    expect(endTime).toBe(entry.endedAt)
    expect(resolveSpan('end', endTime, 15 * MIN)).toEqual(entry)
  })

  it('round-trips back to the original anchor time', () => {
    const toEnd = switchAnchor('start', at(0), 25 * MIN)
    expect(switchAnchor('end', toEnd, 25 * MIN)).toBe(at(0))
  })
})

describe('clampDuration', () => {
  it('never limits an entry anchored on its end', () => {
    expect(clampDuration('end', at(0), 600, at(5))).toBe(600)
  })

  it('stops a start-anchored entry from ending after now', () => {
    // started 40 minutes ago: at most 40 minutes
    expect(clampDuration('start', at(0), 90, at(40))).toBe(40)
  })

  it('leaves a duration that already fits', () => {
    expect(clampDuration('start', at(0), 20, at(40))).toBe(20)
  })

  it('always allows at least one minute, even when the start is just now', () => {
    expect(clampDuration('start', at(0), 30, at(0))).toBe(1)
  })

  it('rounds to whole minutes and never goes below one', () => {
    expect(clampDuration('end', at(0), 12.6, at(10))).toBe(13)
    expect(clampDuration('end', at(0), 0, at(10))).toBe(1)
  })
})
