import { format } from 'date-fns'
import type { Appointment, MilkBag, Measurement, Profile } from '../types'
import { newId } from './id'
import { createPersisted } from './persist'

export const profileStore = createPersisted<Profile>('easykid.profile.v1', {
  name: '',
  birthDate: '',
})
export const growthStore = createPersisted<Measurement[]>('easykid.growth.v1', [])
export const appointmentStore = createPersisted<Appointment[]>(
  'easykid.appointments.v1',
  [],
)

export const bagStore = createPersisted<MilkBag[]>('easykid.bags.v1', [])

/** yyyy-MM-dd in local time */
export const isoDate = (ms: number) => format(ms, 'yyyy-MM-dd')

export const growthActions = {
  add(m: Omit<Measurement, 'id'>) {
    growthStore.set([...growthStore.getSnapshot(), { ...m, id: newId() }])
  },
  update(id: string, m: Omit<Measurement, 'id'>) {
    growthStore.set(
      growthStore.getSnapshot().map((x) => (x.id === id ? { ...m, id } : x)),
    )
  },
  remove(id: string) {
    growthStore.set(growthStore.getSnapshot().filter((x) => x.id !== id))
  },
}

export const appointmentActions = {
  add(a: Omit<Appointment, 'id'>) {
    appointmentStore.set([...appointmentStore.getSnapshot(), { ...a, id: newId() }])
  },
  update(id: string, a: Omit<Appointment, 'id'>) {
    appointmentStore.set(
      appointmentStore.getSnapshot().map((x) => (x.id === id ? { ...a, id } : x)),
    )
  },
  setDone(id: string, done: boolean) {
    appointmentStore.set(
      appointmentStore.getSnapshot().map((x) => (x.id === id ? { ...x, done } : x)),
    )
  },
  remove(id: string) {
    appointmentStore.set(appointmentStore.getSnapshot().filter((x) => x.id !== id))
  },
}

/** Bags of pumped milk. Whether a bag is used is derived from the feeds (lib/storage.ts). */
export const bagActions = {
  add(bag: Omit<MilkBag, 'id'>) {
    const id = newId()
    bagStore.set([...bagStore.getSnapshot(), { ...bag, id }])
    return id
  },
  addMany(bags: Omit<MilkBag, 'id'>[]) {
    bagStore.set([...bagStore.getSnapshot(), ...bags.map((b) => ({ ...b, id: newId() }))])
  },
  update(id: string, bag: Omit<MilkBag, 'id'>) {
    bagStore.set(bagStore.getSnapshot().map((x) => (x.id === id ? { ...bag, id } : x)))
  },
  /** Throw a bag away (spoiled or degraded). Undone with `restore`. */
  discard(id: string, at: number) {
    bagStore.set(
      bagStore.getSnapshot().map((x) => (x.id === id ? { ...x, discardedAt: at } : x)),
    )
  },
  restore(id: string) {
    bagStore.set(
      bagStore.getSnapshot().map((x) => {
        if (x.id !== id) return x
        const { discardedAt: _gone, ...rest } = x
        void _gone
        return rest
      }),
    )
  },
  remove(id: string) {
    bagStore.set(bagStore.getSnapshot().filter((x) => x.id !== id))
  },
}
