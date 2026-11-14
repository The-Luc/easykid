/**
 * Tiny localStorage-backed store compatible with React's useSyncExternalStore.
 * Snapshots are replaced (never mutated) so React can detect changes.
 */
export function createPersisted<T>(key: string, fallback: T) {
  const load = (): T => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  }

  let cache = load()
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((l) => l())

  // Keep several open tabs in sync
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === key) {
        cache = load()
        notify()
      }
    })
  }

  return {
    getSnapshot: () => cache,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set(next: T) {
      cache = next
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // storage full or unavailable: keep working in memory
      }
      notify()
    },
  }
}
