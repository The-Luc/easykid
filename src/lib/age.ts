import { differenceInCalendarDays, parseISO } from 'date-fns'

/** Whole days since birth, or undefined when no valid birth date (or in the future). */
export function ageInDays(birthDate: string, now: number): number | undefined {
  if (!birthDate) return undefined
  const days = differenceInCalendarDays(now, parseISO(birthDate))
  return Number.isNaN(days) || days < 0 ? undefined : days
}

export function ageInWeeks(birthDate: string, now: number): number | undefined {
  const days = ageInDays(birthDate, now)
  return days === undefined ? undefined : Math.floor(days / 7)
}

/** "4 days", "3 weeks", "5 months" */
export function ageLabel(birthDate: string, now: number): string | undefined {
  const days = ageInDays(birthDate, now)
  if (days === undefined) return undefined
  if (days === 0) return 'born today'
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'}`
  if (days < 84) return `${Math.floor(days / 7)} weeks`
  const months = Math.floor(days / 30.44)
  return `${months} ${months === 1 ? 'month' : 'months'}`
}
