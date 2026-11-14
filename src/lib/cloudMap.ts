import type { Appointment, BabyEvent, EventDetails, Measurement, Profile } from '../types'

/** Row shapes as stored in Supabase (snake_case, timestamps as ISO strings). */
export interface EventRow {
  id: string
  baby_id: string
  type: BabyEvent['type']
  started_at: string
  ended_at: string | null
  details: EventDetails | null
  notes: string | null
  updated_at?: string
  deleted_at?: string | null
}

export interface MeasurementRow {
  id: string
  baby_id: string
  date: string
  weight_kg: number | string | null
  length_cm: number | string | null
  head_cm: number | string | null
  updated_at?: string
  deleted_at?: string | null
}

export interface AppointmentRow {
  id: string
  baby_id: string
  date: string
  kind: Appointment['kind']
  title: string
  done: boolean
  notes: string | null
  updated_at?: string
  deleted_at?: string | null
}

export interface BabyRow {
  id: string
  name: string | null
  birth_date: string | null
  updated_at?: string
}

const iso = (ms: number) => new Date(ms).toISOString()
const num = (v: number | string | null): number | undefined =>
  v === null || v === undefined ? undefined : Number(v)

export function eventToRow(e: BabyEvent, babyId: string) {
  return {
    id: e.id,
    baby_id: babyId,
    type: e.type,
    started_at: iso(e.startedAt),
    ended_at: e.endedAt === null ? null : iso(e.endedAt),
    details: e.details ?? {},
    notes: e.notes ?? null,
    deleted_at: null,
  }
}

export function rowToEvent(r: EventRow): BabyEvent {
  return {
    id: r.id,
    type: r.type,
    startedAt: Date.parse(r.started_at),
    endedAt: r.ended_at === null ? null : Date.parse(r.ended_at),
    details: r.details ?? {},
    ...(r.notes ? { notes: r.notes } : {}),
  }
}

export function measurementToRow(m: Measurement, babyId: string) {
  return {
    id: m.id,
    baby_id: babyId,
    date: m.date,
    // null (not undefined) so that removing a metric on one phone clears it everywhere
    weight_kg: m.weightKg ?? null,
    length_cm: m.lengthCm ?? null,
    head_cm: m.headCm ?? null,
    deleted_at: null,
  }
}

export function rowToMeasurement(r: MeasurementRow): Measurement {
  const weightKg = num(r.weight_kg)
  const lengthCm = num(r.length_cm)
  const headCm = num(r.head_cm)
  return {
    id: r.id,
    date: r.date,
    ...(weightKg !== undefined ? { weightKg } : {}),
    ...(lengthCm !== undefined ? { lengthCm } : {}),
    ...(headCm !== undefined ? { headCm } : {}),
  }
}

export function appointmentToRow(a: Appointment, babyId: string) {
  return {
    id: a.id,
    baby_id: babyId,
    date: a.date,
    kind: a.kind,
    title: a.title,
    done: a.done,
    notes: a.notes ?? null,
    deleted_at: null,
  }
}

export function rowToAppointment(r: AppointmentRow): Appointment {
  return {
    id: r.id,
    date: r.date,
    kind: r.kind,
    title: r.title,
    done: r.done,
    ...(r.notes ? { notes: r.notes } : {}),
  }
}

export function profileToRow(p: Profile) {
  return { name: p.name, birth_date: p.birthDate || null }
}

export function rowToProfile(r: BabyRow): Profile {
  return { name: r.name ?? '', birthDate: r.birth_date ?? '' }
}
