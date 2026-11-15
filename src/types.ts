export type PhaseType = 'eat' | 'activity' | 'sleep' | 'you'
/** `pump` is a logged breast-pump session. It is not a phase: it has no timer. */
export type EventType = PhaseType | 'diaper' | 'pump'

export interface EventDetails {
  /** How the feed happened. `ml` is only meaningful for `bottle`. */
  side?: 'left' | 'right' | 'both' | 'bottle'
  ml?: number
  diaper?: 'wet' | 'dirty' | 'both'
  /** Bottle feeds: formula, or pumped breast milk (optionally taken from stored bags). */
  milk?: 'formula' | 'pumped'
  /** The stored bags this feed used. A bag counts as "used" because a feed lists it. */
  bagIds?: string[]
  /** Pump sessions: the breast felt full or tense. */
  full?: boolean
  /** On a feed: the comment for the calculated Activity that follows it (see lib/awake.ts). */
  activityNote?: string
}

export interface Profile {
  name: string
  /** yyyy-MM-dd, or '' when not set */
  birthDate: string
}

export interface Measurement {
  id: string
  /** yyyy-MM-dd */
  date: string
  weightKg?: number
  lengthCm?: number
  headCm?: number
}

export interface Appointment {
  id: string
  /** yyyy-MM-dd */
  date: string
  kind: 'vaccine' | 'visit'
  title: string
  done: boolean
  notes?: string
}

/**
 * A bag of pumped milk in storage. Whether it has been used is not stored here:
 * it is derived from the feeds that list the bag (see lib/storage.ts), so cancelling or
 * deleting a feed puts the bag back automatically.
 */
export interface MilkBag {
  id: string
  /** epoch ms when the milk was pumped */
  pumpedAt: number
  volumeMl: number
  location: 'freezer' | 'fridge'
  /** epoch ms when it was thrown away (spoiled or degraded) */
  discardedAt?: number
  notes?: string
}

export interface BabyEvent {
  id: string
  type: EventType
  /** epoch milliseconds */
  startedAt: number
  /** epoch milliseconds; null while the phase is still running */
  endedAt: number | null
  details: EventDetails
  notes?: string
}
