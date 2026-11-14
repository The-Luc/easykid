import { useEffect, useState, useSyncExternalStore } from 'react'
import { eventStore } from './store'

export function useEvents() {
  return useSyncExternalStore(eventStore.subscribe, eventStore.getSnapshot)
}

/** Subscribe to any store made with createPersisted. */
export function useStore<T>(store: {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => T
}) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

/** Current time in ms, re-rendering every `intervalMs`. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
