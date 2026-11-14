import { isSameDay } from 'date-fns'
import type { BabyEvent, EventType, PhaseType } from '../types'

export function isPhase(type: EventType): type is PhaseType {
  return type !== 'diaper'
}

/** The phase (eat / activity / sleep) that is currently running, if any. */
export function getOpenPhase(
  events: BabyEvent[],
): (BabyEvent & { type: PhaseType }) | undefined {
  return events
    .filter(
      (e): e is BabyEvent & { type: PhaseType } =>
        isPhase(e.type) && e.endedAt === null,
    )
    .sort((a, b) => b.startedAt - a.startedAt)[0]
}

function closeOpenPhases(events: BabyEvent[], now: number): BabyEvent[] {
  return events.map((e) =>
    isPhase(e.type) && e.endedAt === null ? { ...e, endedAt: now } : e,
  )
}

/**
 * Start a phase. Any phase already running is ended at `now`.
 * Starting the phase that is already running changes nothing.
 */
export function startPhase(
  events: BabyEvent[],
  type: PhaseType,
  now: number,
  id: string,
): BabyEvent[] {
  if (getOpenPhase(events)?.type === type) return events
  return [
    ...closeOpenPhases(events, now),
    { id, type, startedAt: now, endedAt: null, details: {} },
  ]
}

/**
 * Stop the running phase. Finishing a feed automatically starts Activity
 * (the E.A.S.Y. flow), using `autoId` for the new event.
 */
export function stopPhase(
  events: BabyEvent[],
  now: number,
  autoId: string,
): BabyEvent[] {
  const open = getOpenPhase(events)
  if (!open) return events
  const closed = closeOpenPhases(events, now)
  if (open.type === 'eat') {
    return [
      ...closed,
      { id: autoId, type: 'activity', startedAt: now, endedAt: null, details: {} },
    ]
  }
  return closed
}

/** Events that started on the same calendar day as `day`, newest first. */
export function eventsOnDay(events: BabyEvent[], day: number): BabyEvent[] {
  return events
    .filter((e) => isSameDay(e.startedAt, day))
    .sort((a, b) => b.startedAt - a.startedAt)
}

export interface DaySummary {
  feeds: number
  diapers: number
  /** Total sleep. This is also the parent's free "You" time. */
  sleepMs: number
}

export function daySummary(
  events: BabyEvent[],
  day: number,
  now: number,
): DaySummary {
  const list = eventsOnDay(events, day)
  return {
    feeds: list.filter((e) => e.type === 'eat').length,
    diapers: list.filter((e) => e.type === 'diaper').length,
    sleepMs: list
      .filter((e) => e.type === 'sleep')
      .reduce((sum, e) => sum + ((e.endedAt ?? now) - e.startedAt), 0),
  }
}
