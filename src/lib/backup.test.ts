import { describe, expect, it } from 'vitest'
import { buildBackup, parseBackup } from './backup'

const sample = buildBackup(
  {
    events: [
      { id: '1', type: 'eat', startedAt: 1, endedAt: 2, details: { side: 'left' } },
    ],
    profile: { name: 'Mia', birthDate: '2026-11-01' },
    growth: [{ id: 'g', date: '2026-11-05', weightKg: 3.4 }],
    appointments: [
      { id: 'a', date: '2026-12-01', kind: 'vaccine', title: 'Hep B', done: false },
    ],
  },
  1000,
)

describe('parseBackup', () => {
  it('round-trips a valid backup', () => {
    const result = parseBackup(JSON.stringify(sample))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.backup).toEqual(sample)
  })

  it('rejects text that is not JSON', () => {
    expect(parseBackup('hello')).toMatchObject({ ok: false })
  })

  it('rejects JSON from some other app', () => {
    expect(parseBackup('{"foo":1}')).toMatchObject({ ok: false })
  })

  it('rejects entries with the wrong shape', () => {
    const bad = { ...sample, events: [{ id: 'x', type: 'dance' }] }
    expect(parseBackup(JSON.stringify(bad))).toMatchObject({ ok: false })
  })
})
