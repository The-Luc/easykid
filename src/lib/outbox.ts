export type Table = 'babies' | 'events' | 'measurements' | 'appointments' | 'milk_bags'

export interface OutboxEntry {
  op: 'upsert' | 'delete'
  /** revision when this entry was last marked; lets us notice edits made during an upload */
  rev: number
}

/** Records waiting to be uploaded. Only ids are stored; the current data is read at upload time. */
export interface Outbox {
  rev: number
  entries: Record<string, OutboxEntry>
}

export const emptyOutbox = (): Outbox => ({ rev: 0, entries: {} })

export const keyOf = (table: Table, id: string) => `${table}:${id}`

export function parseKey(key: string): { table: Table; id: string } {
  const i = key.indexOf(':')
  return { table: key.slice(0, i) as Table, id: key.slice(i + 1) }
}

/** Mark a record as needing upload (or deletion). A later mark replaces an earlier one. */
export function mark(outbox: Outbox, table: Table, id: string, op: OutboxEntry['op']): Outbox {
  const rev = outbox.rev + 1
  return { rev, entries: { ...outbox.entries, [keyOf(table, id)]: { op, rev } } }
}

/** Mark many records at once (linear time; used when uploading everything on first sync). */
export function markMany(
  outbox: Outbox,
  items: { table: Table; id: string; op: OutboxEntry['op'] }[],
): Outbox {
  const entries = { ...outbox.entries }
  let rev = outbox.rev
  for (const item of items) {
    rev += 1
    entries[keyOf(item.table, item.id)] = { op: item.op, rev }
  }
  return { rev, entries }
}

/**
 * Remove uploaded entries. An entry that was marked again after the upload started
 * (its rev changed) stays, so a newer edit is never dropped.
 */
export function clearSent(outbox: Outbox, sent: { key: string; rev: number }[]): Outbox {
  const entries = { ...outbox.entries }
  for (const { key, rev } of sent) {
    if (entries[key]?.rev === rev) delete entries[key]
  }
  return { rev: outbox.rev, entries }
}

export const pendingCount = (outbox: Outbox) => Object.keys(outbox.entries).length
