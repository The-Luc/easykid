import type { BabyEvent, PhaseType } from '../types'
import { cancelPhase, startPhase, stopPhase } from './events'
import { newId } from './id'

const KEY = 'easykid.events.v1'

function load(): BabyEvent[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as BabyEvent[]) : []
  } catch {
    return []
  }
}

let cache: BabyEvent[] = load()
const listeners = new Set<() => void>()

function commit(next: BabyEvent[]) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage full or unavailable: keep working in memory
  }
  listeners.forEach((l) => l())
}

// Keep several open tabs in sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      cache = load()
      listeners.forEach((l) => l())
    }
  })
}


/**
 * Event store. The API is deliberately small so it can later be backed by
 * Supabase without touching the UI.
 */
export const eventStore = {
  getSnapshot: () => cache,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  startPhase(type: PhaseType) {
    commit(startPhase(cache, type, Date.now(), newId()))
  },
  stopPhase() {
    commit(stopPhase(cache, Date.now()))
  },
  /** Throw away the running timer without saving a record. */
  cancelPhase() {
    commit(cancelPhase(cache))
  },
  add(event: Omit<BabyEvent, 'id'>) {
    commit([...cache, { ...event, id: newId() }])
  },
  update(id: string, patch: Partial<Omit<BabyEvent, 'id'>>) {
    commit(cache.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  },
  remove(id: string) {
    commit(cache.filter((e) => e.id !== id))
  },
  /** Replace the whole log (used by backup import and "clear all"). */
  replaceAll(events: BabyEvent[]) {
    commit(events)
  },
}
