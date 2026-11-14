import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { Appointment, BabyEvent, Measurement } from '../types'
import {
  appointmentToRow,
  eventToRow,
  measurementToRow,
  profileToRow,
  rowToAppointment,
  rowToEvent,
  rowToMeasurement,
  rowToProfile,
  type AppointmentRow,
  type BabyRow,
  type EventRow,
  type MeasurementRow,
} from './cloudMap'
import { diffById, ensureUuids, mergeRemote, sameRecord } from './diff'
import { createMemoryStore } from './memstore'
import {
  clearSent,
  emptyOutbox,
  keyOf,
  mark,
  markMany,
  parseKey,
  pendingCount,
  type Outbox,
  type OutboxEntry,
  type Table,
} from './outbox'
import { createPersisted } from './persist'
import { eventStore } from './store'
import { appointmentStore, growthStore, profileStore } from './stores'
import { supabase } from './supabase'

/*
 * Local-first sync between the on-device stores and Supabase.
 *
 *  - The UI only ever reads the local stores, so the app works offline.
 *  - Local edits are detected by diffing the stores and queued in an outbox of ids.
 *  - The outbox is uploaded in batches; changes made by a partner arrive through
 *    realtime and a periodic pull, and are merged into the local stores.
 *  - A record with a pending local edit is never overwritten by the server copy.
 */

const PAGE = 1000 // rows per pull request
const CHUNK = 200 // rows per upload request
const OVERLAP_MS = 10_000 // re-read a little before the cursor so a slow commit is not missed
const POLL_MS = 30_000 // safety net in case realtime drops

interface SyncMeta {
  userId: string | null
  babyId: string | null
  /** newest `updated_at` seen per table */
  cursors: Partial<Record<Table, string>>
  outbox: Outbox
}

export const syncMeta = createPersisted<SyncMeta>('easykid.sync.v1', {
  userId: null,
  babyId: null,
  cursors: {},
  outbox: emptyOutbox(),
})

export type SyncState = 'off' | 'idle' | 'syncing' | 'offline' | 'error'

export const syncStatus = createMemoryStore<{
  state: SyncState
  error?: string
  lastSyncedAt?: number
}>({ state: 'off' })

type Failure = { message?: string; code?: string }
type Sent = { key: string; rev: number }

const isDataError = (e: Failure) => typeof e.code === 'string' && /^2[23]/.test(e.code)

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function setStatus(state: SyncState, error?: string) {
  syncStatus.set((prev) => ({
    state,
    error,
    lastSyncedAt: state === 'idle' ? Date.now() : prev.lastSyncedAt,
  }))
}

function updateMeta(fn: (meta: SyncMeta) => SyncMeta) {
  syncMeta.set(fn(syncMeta.getSnapshot()))
}

function reportFailure(err: unknown) {
  const e = err as Failure
  console.error('[sync]', err)
  const offline =
    (typeof navigator !== 'undefined' && navigator.onLine === false) || !e.code
  setStatus(offline ? 'offline' : 'error', offline ? undefined : e.message)
}

// ---------------------------------------------------------------------------
// Running state
// ---------------------------------------------------------------------------

let running: { userId: string; babyId: string; stop: () => void } | null = null
let applying = 0 // > 0 while writing server data into the local stores
let flushing = false
let flushAgain = false
let pulling = false
let dropped = 0

/** Write server data into the stores without queuing it for upload again. */
function applyRemote(fn: () => void) {
  applying += 1
  try {
    fn()
  } finally {
    applying -= 1
  }
}

// ---------------------------------------------------------------------------
// Local changes -> outbox
// ---------------------------------------------------------------------------

function trackLocal(babyId: string, queueFlush: () => void): () => void {
  let prevEvents = eventStore.getSnapshot()
  let prevGrowth = growthStore.getSnapshot()
  let prevAppts = appointmentStore.getSnapshot()
  let prevProfile = profileStore.getSnapshot()

  const handle = <T extends { id: string }>(table: Table, prev: T[], next: T[]) => {
    if (applying > 0) return
    const { upserts, deletes } = diffById(prev, next)
    if (upserts.length === 0 && deletes.length === 0) return
    updateMeta((m) => ({
      ...m,
      outbox: markMany(m.outbox, [
        ...upserts.map((u) => ({ table, id: u.id, op: 'upsert' as const })),
        ...deletes.map((id) => ({ table, id, op: 'delete' as const })),
      ]),
    }))
    queueFlush()
  }

  const unsubs = [
    eventStore.subscribe(() => {
      const next = eventStore.getSnapshot()
      handle('events', prevEvents, next)
      prevEvents = next
    }),
    growthStore.subscribe(() => {
      const next = growthStore.getSnapshot()
      handle('measurements', prevGrowth, next)
      prevGrowth = next
    }),
    appointmentStore.subscribe(() => {
      const next = appointmentStore.getSnapshot()
      handle('appointments', prevAppts, next)
      prevAppts = next
    }),
    profileStore.subscribe(() => {
      const next = profileStore.getSnapshot()
      if (applying === 0 && !sameRecord(prevProfile, next)) {
        updateMeta((m) => ({ ...m, outbox: mark(m.outbox, 'babies', babyId, 'upsert') }))
        queueFlush()
      }
      prevProfile = next
    }),
  ]
  return () => unsubs.forEach((u) => u())
}

/** First sync for this account on this device: queue everything we already have. */
function seedAll(babyId: string, includeProfile: boolean) {
  // Older entries made over plain http may have ids that are not UUIDs
  applyRemote(() => {
    const events = ensureUuids(eventStore.getSnapshot())
    if (events.changed) eventStore.replaceAll(events.list)
    const growth = ensureUuids(growthStore.getSnapshot())
    if (growth.changed) growthStore.set(growth.list)
    const appts = ensureUuids(appointmentStore.getSnapshot())
    if (appts.changed) appointmentStore.set(appts.list)
  })

  const items = [
    ...eventStore.getSnapshot().map((x) => ({ table: 'events' as const, id: x.id, op: 'upsert' as const })),
    ...growthStore.getSnapshot().map((x) => ({ table: 'measurements' as const, id: x.id, op: 'upsert' as const })),
    ...appointmentStore.getSnapshot().map((x) => ({ table: 'appointments' as const, id: x.id, op: 'upsert' as const })),
    ...(includeProfile ? [{ table: 'babies' as const, id: babyId, op: 'upsert' as const }] : []),
  ]
  updateMeta((m) => ({ ...m, outbox: markMany(m.outbox, items) }))
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

async function pushTable<T extends { id: string }>(
  sb: SupabaseClient,
  table: Exclude<Table, 'babies'>,
  babyId: string,
  current: readonly T[],
  toRow: (item: T, babyId: string) => object,
  entries: [string, OutboxEntry][],
  sent: Sent[],
) {
  const mine = entries.filter(([key]) => parseKey(key).table === table)
  if (mine.length === 0) return

  const byId = new Map(current.map((x) => [x.id, x]))
  const ups: { item: T; sent: Sent }[] = []
  const dels: { id: string; sent: Sent }[] = []
  for (const [key, entry] of mine) {
    const { id } = parseKey(key)
    const item = byId.get(id)
    const ref = { key, rev: entry.rev }
    // an upsert whose record no longer exists locally was deleted in the meantime
    if (entry.op === 'upsert' && item) ups.push({ item, sent: ref })
    else dels.push({ id, sent: ref })
  }

  for (const chunk of chunks(ups, CHUNK)) {
    const { error } = await sb
      .from(table)
      .upsert(chunk.map((c) => toRow(c.item, babyId)), { onConflict: 'id' })
    if (!error) {
      sent.push(...chunk.map((c) => c.sent))
      continue
    }
    if (!isDataError(error)) throw error

    // One malformed row must not block everything behind it: retry one by one
    for (const c of chunk) {
      const single = await sb.from(table).upsert([toRow(c.item, babyId)], { onConflict: 'id' })
      if (!single.error) sent.push(c.sent)
      else if (isDataError(single.error)) {
        console.warn('[sync] dropping a record the server rejected', table, single.error)
        dropped += 1
        sent.push(c.sent)
      } else throw single.error
    }
  }

  for (const chunk of chunks(dels, CHUNK)) {
    // Deletes are soft so they reach the partner's phone too
    const { error } = await sb
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .in('id', chunk.map((c) => c.id))
    if (error) throw error
    sent.push(...chunk.map((c) => c.sent))
  }
}

async function flush() {
  const ctx = running
  if (!supabase || !ctx) return
  if (flushing) {
    flushAgain = true
    return
  }
  const entries = Object.entries(syncMeta.getSnapshot().outbox.entries)
  if (entries.length === 0) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setStatus('offline')
    return
  }

  flushing = true
  dropped = 0
  setStatus('syncing')
  try {
    const sb: SupabaseClient = supabase
    const sent: Sent[] = []

    const babyEntry = syncMeta.getSnapshot().outbox.entries[keyOf('babies', ctx.babyId)]
    if (babyEntry) {
      const { error } = await sb
        .from('babies')
        .update(profileToRow(profileStore.getSnapshot()))
        .eq('id', ctx.babyId)
      if (error) throw error
      sent.push({ key: keyOf('babies', ctx.babyId), rev: babyEntry.rev })
    }

    await pushTable<BabyEvent>(sb, 'events', ctx.babyId, eventStore.getSnapshot(), eventToRow, entries, sent)
    await pushTable<Measurement>(sb, 'measurements', ctx.babyId, growthStore.getSnapshot(), measurementToRow, entries, sent)
    await pushTable<Appointment>(sb, 'appointments', ctx.babyId, appointmentStore.getSnapshot(), appointmentToRow, entries, sent)

    updateMeta((m) => ({ ...m, outbox: clearSent(m.outbox, sent) }))
    if (dropped > 0) {
      setStatus('error', `${dropped} item${dropped === 1 ? '' : 's'} could not be saved to the cloud`)
    } else if (pendingCount(syncMeta.getSnapshot().outbox) === 0) {
      setStatus('idle')
    }
  } catch (err) {
    reportFailure(err)
  } finally {
    flushing = false
    if (flushAgain) {
      flushAgain = false
      setTimeout(() => void flush(), 0)
    }
  }
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

async function pullRows<R extends { updated_at?: string }>(
  sb: SupabaseClient,
  table: Table,
  babyId: string,
): Promise<R[]> {
  const cursor = syncMeta.getSnapshot().cursors[table]
  const since = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : null
  const out: R[] = []

  for (let from = 0; ; from += PAGE) {
    let query = sb
      .from(table)
      .select('*')
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    query = table === 'babies' ? query.eq('id', babyId) : query.eq('baby_id', babyId)
    if (since) query = query.gte('updated_at', since)

    const { data, error } = await query
    if (error) throw error
    out.push(...(data as unknown as R[]))
    if (data.length < PAGE) break
  }

  const newest = out.reduce<string | undefined>(
    (max, r) => (r.updated_at && (!max || Date.parse(r.updated_at) > Date.parse(max)) ? r.updated_at : max),
    undefined,
  )
  if (newest) updateMeta((m) => ({ ...m, cursors: { ...m.cursors, [table]: newest } }))
  return out
}

const pendingKeys = () => syncMeta.getSnapshot().outbox.entries

function applyEvents(rows: EventRow[]) {
  const pending = pendingKeys()
  const { list, changed } = mergeRemote(
    eventStore.getSnapshot(),
    rows.map((r) => ({ id: r.id, deleted: Boolean(r.deleted_at), value: r.deleted_at ? undefined : rowToEvent(r) })),
    (id) => keyOf('events', id) in pending,
  )
  if (changed) applyRemote(() => eventStore.replaceAll(list))
}

function applyMeasurements(rows: MeasurementRow[]) {
  const pending = pendingKeys()
  const { list, changed } = mergeRemote(
    growthStore.getSnapshot(),
    rows.map((r) => ({ id: r.id, deleted: Boolean(r.deleted_at), value: r.deleted_at ? undefined : rowToMeasurement(r) })),
    (id) => keyOf('measurements', id) in pending,
  )
  if (changed) applyRemote(() => growthStore.set(list))
}

function applyAppointments(rows: AppointmentRow[]) {
  const pending = pendingKeys()
  const { list, changed } = mergeRemote(
    appointmentStore.getSnapshot(),
    rows.map((r) => ({ id: r.id, deleted: Boolean(r.deleted_at), value: r.deleted_at ? undefined : rowToAppointment(r) })),
    (id) => keyOf('appointments', id) in pending,
  )
  if (changed) applyRemote(() => appointmentStore.set(list))
}

function applyBaby(row: BabyRow) {
  if (keyOf('babies', row.id) in pendingKeys()) return
  const next = rowToProfile(row)
  if (!sameRecord(profileStore.getSnapshot(), next)) applyRemote(() => profileStore.set(next))
}

async function pull() {
  const ctx = running
  if (!supabase || !ctx || pulling) return
  pulling = true
  try {
    const sb: SupabaseClient = supabase
    const babies = await pullRows<BabyRow>(sb, 'babies', ctx.babyId)
    if (babies[0]) applyBaby(babies[0])
    applyEvents(await pullRows<EventRow>(sb, 'events', ctx.babyId))
    applyMeasurements(await pullRows<MeasurementRow>(sb, 'measurements', ctx.babyId))
    applyAppointments(await pullRows<AppointmentRow>(sb, 'appointments', ctx.babyId))
    if (pendingCount(syncMeta.getSnapshot().outbox) === 0 && syncStatus.getSnapshot().state !== 'error') {
      setStatus('idle')
    }
  } catch (err) {
    reportFailure(err)
  } finally {
    pulling = false
  }
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

function openRealtime(sb: SupabaseClient, babyId: string): RealtimeChannel {
  const channel = sb.channel(`baby-${babyId}`)

  const listen = (table: Table, filter: string, apply: (row: Record<string, unknown>) => void) => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, (payload) => {
      const row = payload.new as Record<string, unknown> | undefined
      // deletes are soft (an update), so a hard-delete payload has no row to apply
      if (row && typeof row.id === 'string') apply(row)
    })
  }

  listen('events', `baby_id=eq.${babyId}`, (r) => applyEvents([r as unknown as EventRow]))
  listen('measurements', `baby_id=eq.${babyId}`, (r) => applyMeasurements([r as unknown as MeasurementRow]))
  listen('appointments', `baby_id=eq.${babyId}`, (r) => applyAppointments([r as unknown as AppointmentRow]))
  listen('babies', `id=eq.${babyId}`, (r) => applyBaby(r as unknown as BabyRow))

  // (Re)connected: catch up on anything missed while the socket was down
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') void pull()
  })
  return channel
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function stopSync() {
  running?.stop()
  running = null
  setStatus('off')
}

/**
 * Start syncing this device with the baby's cloud data.
 * The first time an account is used on this device, everything already stored
 * locally is queued for upload (merged with what is in the cloud).
 */
export async function startSync(
  userId: string,
  babyId: string,
  options: { seedProfile: boolean },
) {
  const sb = supabase
  if (!sb) return
  if (running && running.userId === userId && running.babyId === babyId) return
  stopSync()

  const meta = syncMeta.getSnapshot()
  if (meta.userId !== userId || meta.babyId !== babyId) {
    syncMeta.set({ userId, babyId, cursors: {}, outbox: emptyOutbox() })
    seedAll(babyId, options.seedProfile)
  }

  let flushTimer: ReturnType<typeof setTimeout> | undefined
  const queueFlush = () => {
    clearTimeout(flushTimer)
    flushTimer = setTimeout(() => void flush(), 400)
  }

  const stopTracking = trackLocal(babyId, queueFlush)
  const channel = openRealtime(sb, babyId)
  const poll = setInterval(() => {
    void flush()
    void pull()
  }, POLL_MS)

  const onOnline = () => {
    void flush()
    void pull()
  }
  const onOffline = () => setStatus('offline')
  const onVisible = () => {
    if (document.visibilityState === 'visible') onOnline()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
  }

  running = {
    userId,
    babyId,
    stop() {
      clearTimeout(flushTimer)
      clearInterval(poll)
      stopTracking()
      void sb.removeChannel(channel)
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline)
        window.removeEventListener('offline', onOffline)
        document.removeEventListener('visibilitychange', onVisible)
      }
    },
  }

  setStatus('syncing')
  await flush()
  await pull()
}
