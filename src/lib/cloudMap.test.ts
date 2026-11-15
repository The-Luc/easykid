import { describe, expect, it } from 'vitest'
import type { Appointment, BabyEvent, Measurement, MilkBag } from '../types'
import {
  bagToRow,
  rowToBag,
  appointmentToRow,
  eventToRow,
  measurementToRow,
  profileToRow,
  rowToAppointment,
  rowToEvent,
  rowToMeasurement,
  rowToProfile,
} from './cloudMap'

const BABY = '11111111-1111-4111-8111-111111111111'

describe('events', () => {
  const event: BabyEvent = {
    id: '22222222-2222-4222-8222-222222222222',
    type: 'eat',
    startedAt: Date.parse('2026-11-14T08:00:00.000Z'),
    endedAt: Date.parse('2026-11-14T08:20:00.000Z'),
    details: { side: 'bottle', ml: 90 },
    notes: 'sleepy',
  }

  it('round-trips through a database row', () => {
    expect(rowToEvent(eventToRow(event, BABY))).toEqual(event)
  })

  it('writes ISO timestamps and the baby id', () => {
    const row = eventToRow(event, BABY)
    expect(row.started_at).toBe('2026-11-14T08:00:00.000Z')
    expect(row.baby_id).toBe(BABY)
  })

  it('keeps a running phase running (null end)', () => {
    const running: BabyEvent = { ...event, endedAt: null, notes: undefined }
    const row = eventToRow(running, BABY)
    expect(row.ended_at).toBeNull()
    expect(rowToEvent(row)).toEqual(running)
  })

  it('clears a deleted flag when upserting', () => {
    expect(eventToRow(event, BABY).deleted_at).toBeNull()
  })
})

describe('measurements', () => {
  it('round-trips and leaves out metrics that were not recorded', () => {
    const m: Measurement = { id: 'a', date: '2026-11-10', weightKg: 3.45 }
    const row = measurementToRow(m, BABY)
    expect(row.length_cm).toBeNull()
    expect(rowToMeasurement(row)).toEqual(m)
  })

  it('accepts numeric columns that arrive as strings', () => {
    const m = rowToMeasurement({
      id: 'a',
      baby_id: BABY,
      date: '2026-11-10',
      weight_kg: '3.450',
      length_cm: null,
      head_cm: '35.5',
    })
    expect(m).toEqual({ id: 'a', date: '2026-11-10', weightKg: 3.45, headCm: 35.5 })
  })
})

describe('appointments', () => {
  it('round-trips', () => {
    const a: Appointment = {
      id: 'x',
      date: '2026-12-01',
      kind: 'vaccine',
      title: 'Hep B',
      done: true,
      notes: 'bring card',
    }
    expect(rowToAppointment(appointmentToRow(a, BABY))).toEqual(a)
  })
})

describe('profile', () => {
  it('maps an empty birth date to null and back', () => {
    expect(profileToRow({ name: 'Mia', birthDate: '' })).toEqual({
      name: 'Mia',
      birth_date: null,
    })
    expect(rowToProfile({ id: BABY, name: null, birth_date: null })).toEqual({
      name: '',
      birthDate: '',
    })
  })
})

describe('milk bags', () => {
  const bag: MilkBag = {
    id: 'bag-1',
    pumpedAt: Date.parse('2026-11-14T07:10:00.000Z'),
    volumeMl: 120,
    location: 'freezer',
    notes: 'first bag',
  }

  it('round-trips through a database row', () => {
    expect(rowToBag(bagToRow(bag, BABY) as never)).toEqual(bag)
  })

  it('stores "not thrown away" as null so putting a bag back clears it everywhere', () => {
    expect(bagToRow(bag, BABY).discarded_at).toBeNull()
    const thrown = { ...bag, discardedAt: Date.parse('2026-11-15T08:00:00.000Z') }
    const row = bagToRow(thrown, BABY)
    expect(row.discarded_at).toBe('2026-11-15T08:00:00.000Z')
    expect(rowToBag(row as never).discardedAt).toBe(thrown.discardedAt)
  })
})
