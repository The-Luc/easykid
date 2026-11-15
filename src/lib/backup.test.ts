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
    bags: [{ id: 'b1', pumpedAt: 5, volumeMl: 120, location: 'freezer' }],
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

describe('breast pump entries', () => {
  it('are accepted by a backup', () => {
    const withPump = buildBackup(
      {
        ...sample,
        events: [
          { id: 'p', type: 'pump', startedAt: 1, endedAt: 2, details: { side: 'both', ml: 120 } },
        ],
      },
      1000,
    )
    expect(parseBackup(JSON.stringify(withPump)).ok).toBe(true)
  })
})

describe('milk bags in a backup', () => {
  it('are restored, and an older backup with no bags still imports', () => {
    const withBags = parseBackup(JSON.stringify(sample))
    expect(withBags.ok && withBags.backup.bags).toEqual(sample.bags)

    const { bags: _bags, ...older } = sample
    void _bags
    const result = parseBackup(JSON.stringify(older))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.backup.bags).toEqual([])
  })

  it('rejects a bag with the wrong shape', () => {
    const bad = { ...sample, bags: [{ id: 'x', volumeMl: 'lots' }] }
    expect(parseBackup(JSON.stringify(bad))).toMatchObject({ ok: false })
  })
})
