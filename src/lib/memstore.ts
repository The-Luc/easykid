/** Small in-memory store compatible with React's useSyncExternalStore (not persisted). */
export function createMemoryStore<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set(next: T | ((prev: T) => T)) {
      state = typeof next === 'function' ? (next as (prev: T) => T)(state) : next
      listeners.forEach((l) => l())
    },
  }
}
