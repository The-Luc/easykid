/**
 * End-to-end sync test against a REAL Supabase project.
 *
 * Skipped unless RUN_CLOUD_TESTS=1 and the two public settings are present, because it
 * signs up throwaway accounts and writes real rows. Run it with:
 *
 *   set -a; . ./.env.local; set +a
 *   RUN_CLOUD_TESTS=1 npx vitest run src/lib/cloud.integration.test.ts
 *
 * "Phone A" is the real sync engine. "Phone B" (the partner) is a plain Supabase client.
 * Afterwards remove the test data (accounts with an email starting "easykid-itest-").
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { isUuid } from './id'
import { pendingCount } from './outbox'
import type { BabyEvent } from '../types'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const enabled = process.env.RUN_CLOUD_TESTS === '1' && Boolean(url) && Boolean(key)

const stamp = Date.now()
const PASSWORD = 'itest-password-123'
const emailA = `easykid-itest-a-${stamp}@easykid-itest.dev`
const emailB = `easykid-itest-b-${stamp}@easykid-itest.dev`

async function waitFor(check: () => boolean | Promise<boolean>, what: string, ms = 45_000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await check()) return
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`timed out waiting for: ${what}`)
}

describe.skipIf(!enabled)('cloud sync against the real Supabase project', () => {
  let cloud: typeof import('./cloud')
  let sync: typeof import('./sync')
  let stores: typeof import('./stores')
  let store: typeof import('./store')
  let sbA: SupabaseClient
  let sbB: SupabaseClient
  let babyId = ''
  let keptEventId = ''
  let oldStyleEventId = 'old-style-id-1'

  const synced = () =>
    sync.syncStatus.getSnapshot().state === 'idle' &&
    pendingCount(sync.syncMeta.getSnapshot().outbox) === 0

  beforeAll(async () => {
    // A fake localStorage, filled BEFORE the stores load so the device already has data
    const mem = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, String(v)),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
      key: (i: number) => [...mem.keys()][i] ?? null,
      get length() {
        return mem.size
      },
    })

    const now = Date.now()
    keptEventId = crypto.randomUUID()
    const events: BabyEvent[] = [
      {
        id: oldStyleEventId, // not a UUID: made over plain http before the id fix
        type: 'eat',
        startedAt: now - 3 * 3_600_000,
        endedAt: now - 3 * 3_600_000 + 15 * 60_000,
        details: { side: 'left' },
      },
      {
        id: keptEventId,
        type: 'sleep',
        startedAt: now - 2 * 3_600_000,
        endedAt: now - 3_600_000,
        details: {},
      },
    ]
    mem.set('easykid.events.v1', JSON.stringify(events))
    mem.set(
      'easykid.growth.v1',
      JSON.stringify([{ id: 'old-m', date: '2026-11-10', weightKg: 3.5 }]),
    )
    mem.set(
      'easykid.appointments.v1',
      JSON.stringify([
        { id: crypto.randomUUID(), date: '2026-12-01', kind: 'vaccine', title: 'Hep B', done: false },
      ]),
    )
    mem.set('easykid.profile.v1', JSON.stringify({ name: 'Test Baby', birthDate: '2026-11-01' }))

    vi.resetModules()
    store = await import('./store')
    stores = await import('./stores')
    sync = await import('./sync')
    cloud = await import('./cloud')
    const { supabase } = await import('./supabase')
    if (!supabase) throw new Error('supabase client missing')
    sbA = supabase
    sbB = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } })
  })

  afterAll(async () => {
    sync?.stopSync()
    await sbA?.auth.signOut().catch(() => undefined)
    await sbB?.auth.signOut().catch(() => undefined)
  })

  it('signs up, creates the baby and uploads what is already on the device', async () => {
    cloud.initCloud()
    await waitFor(() => cloud.cloudStore.getSnapshot().phase === 'signedOut', 'signed-out state')

    const signUp = await cloud.signUp(emailA, PASSWORD)
    expect(signUp).toEqual({ ok: true, value: undefined })
    await waitFor(() => cloud.cloudStore.getSnapshot().phase === 'needsBaby', 'needsBaby state')

    const created = await cloud.createBaby()
    expect(created.ok).toBe(true)
    await waitFor(() => cloud.cloudStore.getSnapshot().phase === 'ready', 'ready state')
    await waitFor(synced, 'first upload to finish')

    babyId = cloud.cloudStore.getSnapshot().babyId!
    expect(isUuid(babyId)).toBe(true)

    const { data: events, error } = await sbA.from('events').select('*').eq('baby_id', babyId)
    expect(error).toBeNull()
    expect(events).toHaveLength(2)
    expect(events!.every((e) => isUuid(e.id))).toBe(true)
    expect(events!.some((e) => e.id === oldStyleEventId)).toBe(false) // it was given a real UUID

    // the same remap happened locally, so both sides agree on the ids
    const localIds = store.eventStore.getSnapshot().map((e) => e.id)
    expect(localIds.every(isUuid)).toBe(true)
    expect(localIds.sort()).toEqual(events!.map((e) => e.id).sort())

    const { data: baby } = await sbA.from('babies').select('name, birth_date').eq('id', babyId).single()
    expect(baby).toEqual({ name: 'Test Baby', birth_date: '2026-11-01' })

    const { data: m } = await sbA.from('measurements').select('weight_kg').eq('baby_id', babyId)
    expect(m).toHaveLength(1)
    expect(Number(m![0].weight_kg)).toBe(3.5)
  }, 120_000)

  it('lets a partner join with an invite code and see the data', async () => {
    const invite = await cloud.createInvite()
    expect(invite.ok).toBe(true)
    const code = (invite as { ok: true; value: string }).value
    expect(code).toMatch(/^[A-Z2-9]{6}$/)

    const signUp = await sbB.auth.signUp({ email: emailB, password: PASSWORD })
    expect(signUp.error).toBeNull()
    expect(signUp.data.session).not.toBeNull()

    const joined = await sbB.rpc('accept_invite', { p_code: code })
    expect(joined.error).toBeNull()
    expect(joined.data).toBe(babyId)

    const { data: events } = await sbB.from('events').select('id').eq('baby_id', babyId)
    expect(events).toHaveLength(2)
    expect(await cloud.countMembers()).toBe(2)
  }, 120_000)

  it("brings a partner's new entry onto this device", async () => {
    const id = crypto.randomUUID()
    const { error } = await sbB.from('events').insert({
      id,
      baby_id: babyId,
      type: 'eat',
      started_at: new Date().toISOString(),
      ended_at: null,
      details: { side: 'bottle', ml: 90 },
    })
    expect(error).toBeNull()

    const t0 = Date.now()
    await waitFor(
      () => store.eventStore.getSnapshot().some((e) => e.id === id && e.details.ml === 90),
      "partner's event to arrive",
      60_000,
    )
    console.log(`partner entry arrived after ${Date.now() - t0} ms`)

    // it was applied from the server, so it must NOT be queued for upload again
    expect(pendingCount(sync.syncMeta.getSnapshot().outbox)).toBe(0)
  }, 120_000)

  it("sends this device's edits and deletes to the partner", async () => {
    store.eventStore.update(keptEventId, { notes: 'edited on phone A' })
    await waitFor(synced, 'edit to upload')
    const { data: edited } = await sbB.from('events').select('notes, deleted_at').eq('id', keptEventId).single()
    expect(edited).toEqual({ notes: 'edited on phone A', deleted_at: null })

    store.eventStore.remove(keptEventId)
    await waitFor(synced, 'delete to upload')
    const { data: removed } = await sbB.from('events').select('deleted_at').eq('id', keptEventId).single()
    expect(removed!.deleted_at).not.toBeNull() // soft delete, so the partner's phone drops it too
  }, 120_000)

  it("removes entries the partner deleted", async () => {
    const victim = store.eventStore.getSnapshot().find((e) => e.details.ml === 90)!
    const { error } = await sbB
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', victim.id)
    expect(error).toBeNull()

    await waitFor(
      () => !store.eventStore.getSnapshot().some((e) => e.id === victim.id),
      "partner's delete to arrive",
      60_000,
    )
    expect(stores.profileStore.getSnapshot().name).toBe('Test Baby')
  }, 120_000)

  it('syncs milk bags, and which feed used them, with the partner', async () => {
    // phone A puts a bag in storage
    const bagId = stores.bagActions.add({
      pumpedAt: Date.now() - 3_600_000,
      volumeMl: 120,
      location: 'freezer',
    })
    await waitFor(synced, 'bag to upload')
    const { data: row } = await sbB.from('milk_bags').select('*').eq('id', bagId).single()
    expect(row).toMatchObject({ volume_ml: 120, location: 'freezer', discarded_at: null, deleted_at: null })

    // a feed that lists the bag is what marks it used: nothing about use is stored on the bag
    store.eventStore.add({
      type: 'eat',
      startedAt: Date.now() - 600_000,
      endedAt: Date.now() - 300_000,
      details: { side: 'bottle', milk: 'pumped', ml: 120, bagIds: [bagId] },
    })
    await waitFor(synced, 'feed to upload')
    const { data: feeds } = await sbB
      .from('events')
      .select('details')
      .eq('baby_id', babyId)
      .eq('type', 'eat')
      .is('deleted_at', null)
    expect(feeds!.some((f) => (f.details.bagIds ?? []).includes(bagId))).toBe(true)

    // throwing a bag away, and putting it back, reach the partner
    stores.bagActions.discard(bagId, Date.now())
    await waitFor(synced, 'discard to upload')
    const thrown = await sbB.from('milk_bags').select('discarded_at').eq('id', bagId).single()
    expect(thrown.data!.discarded_at).not.toBeNull()
    stores.bagActions.restore(bagId)
    await waitFor(synced, 'restore to upload')
    const restored = await sbB.from('milk_bags').select('discarded_at').eq('id', bagId).single()
    expect(restored.data!.discarded_at).toBeNull()

    // the partner's bag arrives on this phone
    const partnerBag = crypto.randomUUID()
    const { error } = await sbB.from('milk_bags').insert({
      id: partnerBag,
      baby_id: babyId,
      pumped_at: new Date().toISOString(),
      volume_ml: 90,
      location: 'fridge',
    })
    expect(error).toBeNull()
    await waitFor(
      () => stores.bagStore.getSnapshot().some((b) => b.id === partnerBag && b.volumeMl === 90),
      "partner's bag to arrive",
      60_000,
    )

    // removing a bag is a soft delete, so it disappears on the partner's phone too
    stores.bagActions.remove(bagId)
    await waitFor(synced, 'delete to upload')
    const removed = await sbB.from('milk_bags').select('deleted_at').eq('id', bagId).single()
    expect(removed.data!.deleted_at).not.toBeNull()
  }, 120_000)
})
