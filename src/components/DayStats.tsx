import { formatDuration } from '../lib/format'
import type { DaySummary } from '../lib/events'
import type { EventType } from '../types'

export type StatFilter = Extract<EventType, 'eat' | 'sleep' | 'diaper' | 'pump' | 'activity'>

export const FILTER_LABEL: Record<StatFilter, string> = {
  eat: 'Feeds',
  sleep: 'Sleep',
  diaper: 'Diapers',
  pump: 'Pumps',
  activity: 'Activity',
}

type Props = {
  summary: DaySummary
  /** Total activity time. Passing it adds the Activity stat. */
  activityMs?: number
  /** Passing onToggle makes the stats tappable filters (Today). History leaves it out. */
  active?: StatFilter | null
  onToggle?: (filter: StatFilter) => void
}

export default function DayStats({ summary, activityMs, active = null, onToggle }: Props) {
  // The pump card only appears on days you pumped
  const pumped = summary.pumps > 0
  const showActivity = activityMs !== undefined

  const stats: { key: StatFilter; num: string | number; label: string }[] = [
    { key: 'eat', num: summary.feeds, label: 'Feeds' },
    { key: 'sleep', num: formatDuration(summary.sleepMs), label: 'Sleep' },
    { key: 'diaper', num: summary.diapers, label: 'Diapers' },
  ]
  if (pumped) {
    stats.push({
      key: 'pump',
      num: summary.pumpMl > 0 ? summary.pumpMl : summary.pumps,
      label: summary.pumpMl > 0 ? 'ml pumped' : 'Pumps',
    })
  }
  if (showActivity) {
    stats.push({ key: 'activity', num: formatDuration(activityMs), label: 'Activity' })
  }

  const cols = stats.length === 5 ? ' five' : stats.length === 4 ? ' four' : ''

  return (
    <section className={`stats-row${cols}`}>
      {stats.map((s) => {
        const body = (
          <>
            <span className="stat-num">{s.num}</span>
            <span className="stat-label">{s.label}</span>
          </>
        )
        if (!onToggle) {
          return (
            <div key={s.key} className="stat">
              {body}
            </div>
          )
        }
        const on = active === s.key
        return (
          <button
            key={s.key}
            type="button"
            className={`stat stat-btn${on ? ' active' : ''}`}
            aria-pressed={on}
            onClick={() => onToggle(s.key)}
          >
            {body}
          </button>
        )
      })}
    </section>
  )
}
