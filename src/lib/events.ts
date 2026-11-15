import { isSameDay } from 'date-fns'
import type { BabyEvent, EventType, PhaseType } from '../types'

/** Phases are the things that have a running timer (eat, sleep, activity). */
export function isPhase(type: EventType): type is PhaseType {
  return type !== 'diaper' && type !== 'pump'
}

/** Amount (ml) of the most recent pump session that recorded one; used as the next default. */
export function lastPumpMl(events: BabyEvent[]): number | undefined {
  return events
    .filter((e) => e.type === 'pump' && e.details.ml)
    .sort((a, b) => b.startedAt - a.startedAt)[0]?.details.ml
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
 * Stop the running phase and keep it as a record. Nothing is started afterwards:
 * Activity is calculated from eat and sleep times (see awake.ts).
 */
export function stopPhase(events: BabyEvent[], now: number): BabyEvent[] {
  if (!getOpenPhase(events)) return events
  return closeOpenPhases(events, now)
}

/** Discard the running phase entirely (for a timer started by mistake). No record is kept. */
export function cancelPhase(events: BabyEvent[]): BabyEvent[] {
  const open = getOpenPhase(events)
  return open ? events.filter((e) => e.id !== open.id) : events
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
  /** Breast-pump sessions and the total amount pumped (ml) */
  pumps: number
  pumpMl: number
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
    pumps: list.filter((e) => e.type === 'pump').length,
    pumpMl: list
      .filter((e) => e.type === 'pump')
      .reduce((sum, e) => sum + (e.details.ml ?? 0), 0),
  }
}
