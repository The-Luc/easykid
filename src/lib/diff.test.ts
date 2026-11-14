import { describe, expect, it } from 'vitest'
import { diffById, ensureUuids, mergeRemote, sameRecord } from './diff'

interface R {
  id: string
  v: number
  note?: string
}

describe('sameRecord', () => {
  it('ignores key order and undefined values', () => {
    expect(sameRecord({ a: 1, b: { x: 1, y: 2 } }, { b: { y: 2, x: 1 }, a: 1, c: undefined })).toBe(true)
    expect(sameRecord({ a: 1 }, { a: 2 })).toBe(false)
  })
})

describe('diffById', () => {
  it('finds added, changed and removed records', () => {
    const prev: R[] = [
      { id: 'a', v: 1 },
      { id: 'b', v: 2 },
      { id: 'c', v: 3 },
    ]
    const next: R[] = [
      { id: 'a', v: 1 }, // unchanged
      { id: 'b', v: 20 }, // changed
      { id: 'd', v: 4 }, // added
    ]
    const { upserts, deletes } = diffById(prev, next)
    expect(upserts.map((x) => x.id)).toEqual(['b', 'd'])
    expect(deletes).toEqual(['c'])
  })

  it('reports nothing for equal lists, even with new object references', () => {
    const prev: R[] = [{ id: 'a', v: 1 }]
    const next: R[] = [{ v: 1, id: 'a' }]
    expect(diffById(prev, next)).toEqual({ upserts: [], deletes: [] })
  })
})

describe('mergeRemote', () => {
  const local: R[] = [
    { id: 'a', v: 1 },
    { id: 'b', v: 2 },
  ]
  const never = () => false

  it('adds and updates records from the server', () => {
    const { list, changed } = mergeRemote(
      local,
      [
        { id: 'b', deleted: false, value: { id: 'b', v: 22 } },
        { id: 'c', deleted: false, value: { id: 'c', v: 3 } },
      ],
      never,
    )
    expect(changed).toBe(true)
    expect(list).toEqual([
      { id: 'a', v: 1 },
      { id: 'b', v: 22 },
      { id: 'c', v: 3 },
    ])
  })

  it('removes records the server marks deleted', () => {
    const { list } = mergeRemote(local, [{ id: 'a', deleted: true }], never)
    expect(list).toEqual([{ id: 'b', v: 2 }])
  })

  it('keeps a pending local edit instead of the older server copy', () => {
    const { list, changed } = mergeRemote(
      local,
      [{ id: 'b', deleted: false, value: { id: 'b', v: 999 } }],
      (id) => id === 'b',
    )
    expect(changed).toBe(false)
    expect(list).toBe(local)
  })

  it('does not report a change when the server copy is identical', () => {
    const { list, changed } = mergeRemote(
      local,
      [{ id: 'a', deleted: false, value: { v: 1, id: 'a' } }],
      never,
    )
    expect(changed).toBe(false)
    expect(list).toBe(local)
  })

  it('ignores deleting a record we do not have', () => {
    expect(mergeRemote(local, [{ id: 'zzz', deleted: true }], never).changed).toBe(false)
  })
})

describe('ensureUuids', () => {
  const good = '3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d'

  it('keeps UUIDs and replaces old-style ids', () => {
    const { list, changed } = ensureUuids<R>([
      { id: good, v: 1 },
      { id: 'mhx1k2-ab12cd34', v: 2 },
    ])
    expect(changed).toBe(true)
    expect(list[0].id).toBe(good)
    expect(list[1].id).not.toBe('mhx1k2-ab12cd34')
    expect(list[1].id).toMatch(/^[0-9a-f-]{36}$/)
    expect(list[1].v).toBe(2)
  })

  it('returns the same list when nothing needs fixing', () => {
    const input: R[] = [{ id: good, v: 1 }]
    const result = ensureUuids(input)
    expect(result.changed).toBe(false)
    expect(result.list).toBe(input)
  })
})
