import { afterEach, describe, expect, it, vi } from 'vitest'
import { newId } from './id'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('newId', () => {
  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-from-crypto' })
    expect(newId()).toBe('uuid-from-crypto')
  })

  it('falls back when randomUUID is missing (insecure http context)', () => {
    vi.stubGlobal('crypto', {})
    const id = newId()
    expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/)
  })

  it('falls back when crypto does not exist at all', () => {
    vi.stubGlobal('crypto', undefined)
    expect(newId()).toMatch(/^[a-z0-9]+-[a-z0-9]+$/)
  })

  it('returns different ids on each call', () => {
    vi.stubGlobal('crypto', {})
    const ids = new Set(Array.from({ length: 200 }, () => newId()))
    expect(ids.size).toBe(200)
  })
})
