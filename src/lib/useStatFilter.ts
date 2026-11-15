import { useRef, useState } from 'react'
import type { StatFilter } from '../components/DayStats'

/**
 * Stat-tap filter for an event list. While a filter is on, the list box keeps the
 * height it had unfiltered, so the page does not shrink and jump.
 */
export function useStatFilter() {
  const [filter, setFilter] = useState<StatFilter | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [lockedHeight, setLockedHeight] = useState<number | undefined>()

  const toggle = (f: StatFilter) => {
    if (filter === null) setLockedHeight(listRef.current?.offsetHeight)
    const next = filter === f ? null : f
    if (next === null) setLockedHeight(undefined)
    setFilter(next)
  }

  const reset = () => {
    setFilter(null)
    setLockedHeight(undefined)
  }

  return { filter, toggle, reset, listRef, lockedHeight }
}
