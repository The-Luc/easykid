import type { Appointment, BabyEvent, Measurement, Profile } from '../types'

export interface Backup {
  app: 'easykid'
  version: 1
  exportedAt: number
  events: BabyEvent[]
  profile: Profile
  growth: Measurement[]
  appointments: Appointment[]
}

const EVENT_TYPES = ['eat', 'activity', 'sleep', 'you', 'diaper', 'pump']

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isEvent = (v: unknown): v is BabyEvent =>
  isObj(v) &&
  typeof v.id === 'string' &&
  typeof v.type === 'string' &&
  EVENT_TYPES.includes(v.type) &&
  typeof v.startedAt === 'number' &&
  (v.endedAt === null || typeof v.endedAt === 'number') &&
  isObj(v.details)

const isMeasurement = (v: unknown): v is Measurement =>
  isObj(v) && typeof v.id === 'string' && typeof v.date === 'string'

const isAppointment = (v: unknown): v is Appointment =>
  isObj(v) &&
  typeof v.id === 'string' &&
  typeof v.date === 'string' &&
  typeof v.title === 'string' &&
  (v.kind === 'vaccine' || v.kind === 'visit') &&
  typeof v.done === 'boolean'

export function buildBackup(
  data: Omit<Backup, 'app' | 'version' | 'exportedAt'>,
  now: number,
): Backup {
  return { app: 'easykid', version: 1, exportedAt: now, ...data }
}

export function parseBackup(
  text: string,
): { ok: true; backup: Backup } | { ok: false; error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }

  if (
    !isObj(raw) ||
    raw.app !== 'easykid' ||
    raw.version !== 1 ||
    !Array.isArray(raw.events) ||
    !Array.isArray(raw.growth) ||
    !Array.isArray(raw.appointments) ||
    !isObj(raw.profile)
  ) {
    return { ok: false, error: 'This does not look like an EasyKid backup.' }
  }

  if (
    !raw.events.every(isEvent) ||
    !raw.growth.every(isMeasurement) ||
    !raw.appointments.every(isAppointment) ||
    typeof raw.profile.name !== 'string' ||
    typeof raw.profile.birthDate !== 'string'
  ) {
    return { ok: false, error: 'The backup has entries in an unexpected format.' }
  }

  return {
    ok: true,
    backup: {
      app: 'easykid',
      version: 1,
      exportedAt: typeof raw.exportedAt === 'number' ? raw.exportedAt : 0,
      events: raw.events,
      profile: { name: raw.profile.name, birthDate: raw.profile.birthDate },
      growth: raw.growth,
      appointments: raw.appointments,
    },
  }
}
