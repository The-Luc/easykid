import { describe, expect, it } from 'vitest'
import { ageInWeeks, ageLabel } from './age'

const NOW = new Date('2026-11-14T12:00:00').getTime()

describe('ageLabel', () => {
  it('returns undefined without a valid birth date', () => {
    expect(ageLabel('', NOW)).toBeUndefined()
    expect(ageLabel('not-a-date', NOW)).toBeUndefined()
    expect(ageLabel('2027-01-01', NOW)).toBeUndefined()
  })

  it('formats days, weeks and months', () => {
    expect(ageLabel('2026-11-14', NOW)).toBe('born today')
    expect(ageLabel('2026-11-13', NOW)).toBe('1 day')
    expect(ageLabel('2026-11-10', NOW)).toBe('4 days')
    expect(ageLabel('2026-10-24', NOW)).toBe('3 weeks')
    expect(ageLabel('2026-05-14', NOW)).toBe('6 months')
  })
})

describe('ageInWeeks', () => {
  it('floors to whole weeks', () => {
    expect(ageInWeeks('2026-11-01', NOW)).toBe(1) // 13 days
    expect(ageInWeeks('2026-10-31', NOW)).toBe(2) // 14 days
  })
})
