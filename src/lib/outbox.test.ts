import { describe, expect, it } from 'vitest'
import {
  clearSent,
  emptyOutbox,
  keyOf,
  mark,
  markMany,
  parseKey,
  pendingCount,
} from './outbox'

describe('outbox', () => {
  it('marks records and counts them', () => {
    let o = emptyOutbox()
    o = mark(o, 'events', 'a', 'upsert')
    o = mark(o, 'events', 'b', 'upsert')
    expect(pendingCount(o)).toBe(2)
  })

  it('lets a delete replace an earlier upsert of the same record', () => {
    let o = mark(emptyOutbox(), 'events', 'a', 'upsert')
    o = mark(o, 'events', 'a', 'delete')
    expect(pendingCount(o)).toBe(1)
    expect(o.entries[keyOf('events', 'a')].op).toBe('delete')
  })

  it('clears entries that were uploaded', () => {
    let o = mark(emptyOutbox(), 'events', 'a', 'upsert')
    o = mark(o, 'events', 'b', 'upsert')
    const sent = Object.entries(o.entries).map(([key, e]) => ({ key, rev: e.rev }))
    expect(pendingCount(clearSent(o, sent))).toBe(0)
  })

  it('keeps a record that was edited again while its upload was running', () => {
    let o = mark(emptyOutbox(), 'events', 'a', 'upsert')
    const sent = Object.entries(o.entries).map(([key, e]) => ({ key, rev: e.rev }))
    o = mark(o, 'events', 'a', 'upsert') // edited during the upload
    const after = clearSent(o, sent)
    expect(pendingCount(after)).toBe(1)
  })

  it('marks many records at once with increasing revisions', () => {
    const o = markMany(mark(emptyOutbox(), 'events', 'a', 'delete'), [
      { table: 'events', id: 'a', op: 'upsert' },
      { table: 'measurements', id: 'm', op: 'upsert' },
    ])
    expect(pendingCount(o)).toBe(2)
    expect(o.entries[keyOf('events', 'a')].op).toBe('upsert')
    expect(o.entries[keyOf('measurements', 'm')].rev).toBeGreaterThan(
      o.entries[keyOf('events', 'a')].rev,
    )
  })

  it('parses keys, including ids that contain a colon', () => {
    expect(parseKey(keyOf('measurements', 'x:y'))).toEqual({ table: 'measurements', id: 'x:y' })
  })
})
