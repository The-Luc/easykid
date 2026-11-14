import { afterEach, describe, expect, it, vi } from 'vitest'
import { isUuid, newId } from './id'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('newId', () => {
  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-from-crypto' })
    expect(newId()).toBe('uuid-from-crypto')
  })

  it('builds a valid v4 UUID from getRandomValues when randomUUID is missing (insecure http)', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (a: Uint8Array) => {
        for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 11) % 256
        return a
      },
    })
    const id = newId()
    expect(isUuid(id)).toBe(true)
    expect(id[14]).toBe('4') // version nibble
    expect('89ab').toContain(id[19]) // variant nibble
  })

  it('still returns a valid UUID when crypto does not exist at all', () => {
    vi.stubGlobal('crypto', undefined)
    expect(isUuid(newId())).toBe(true)
  })

  it('returns different ids on each call', () => {
    vi.stubGlobal('crypto', undefined)
    const ids = new Set(Array.from({ length: 500 }, () => newId()))
    expect(ids.size).toBe(500)
  })
})

describe('isUuid', () => {
  it('accepts real UUIDs and rejects old-style ids', () => {
    expect(isUuid('3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d')).toBe(true)
    expect(isUuid('mhx1k2-ab12cd34')).toBe(false)
    expect(isUuid('')).toBe(false)
  })
})
