import { format } from 'date-fns'
import type { Appointment, Measurement, Profile } from '../types'
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
