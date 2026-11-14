import { isUuid, newId } from './id'

/** JSON with sorted keys, so two equal records compare equal whatever their key order. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return `{${Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export const sameRecord = (a: unknown, b: unknown) => a === b || stable(a) === stable(b)

/** What changed between two lists of records (matched by id). */
export function diffById<T extends { id: string }>(prev: readonly T[], next: readonly T[]) {
  const before = new Map(prev.map((x) => [x.id, x]))
  const present = new Set<string>()
  const upserts: T[] = []

  for (const item of next) {
    present.add(item.id)
    const old = before.get(item.id)
    if (!old || !sameRecord(old, item)) upserts.push(item)
  }
  const deletes = prev.filter((x) => !present.has(x.id)).map((x) => x.id)
  return { upserts, deletes }
}

export interface RemoteChange<T> {
  id: string
  deleted: boolean
  value?: T
}

/**
 * Apply changes that arrived from the server. A record with a pending local edit is
 * skipped: our upload will overwrite the server copy, so the local edit wins.
 */
export function mergeRemote<T extends { id: string }>(
  local: readonly T[],
  changes: readonly RemoteChange<T>[],
  isPending: (id: string) => boolean,
): { list: T[]; changed: boolean } {
  const byId = new Map(local.map((x) => [x.id, x]))
  let changed = false

  for (const c of changes) {
    if (isPending(c.id)) continue
    if (c.deleted) {
      if (byId.delete(c.id)) changed = true
    } else if (c.value) {
      const old = byId.get(c.id)
      if (!old || !sameRecord(old, c.value)) {
        byId.set(c.id, c.value)
        changed = true
      }
    }
  }
  return { list: changed ? Array.from(byId.values()) : (local as T[]), changed }
}

/** Give any record whose id is not a real UUID a new one (older entries made over plain http). */
export function ensureUuids<T extends { id: string }>(
  list: readonly T[],
): { list: T[]; changed: boolean } {
  let changed = false
  const out = list.map((x) => {
    if (isUuid(x.id)) return x
    changed = true
    return { ...x, id: newId() }
  })
  return { list: changed ? out : (list as T[]), changed }
}
