import { formatDuration } from '../lib/format'
import type { DaySummary } from '../lib/events'

export default function DayStats({ summary }: { summary: DaySummary }) {
  return (
    <section className="stats-row">
      <div className="stat">
        <span className="stat-num">{summary.feeds}</span>
        <span className="stat-label">Feeds</span>
      </div>
      <div className="stat">
        <span className="stat-num">{formatDuration(summary.sleepMs)}</span>
        <span className="stat-label">Sleep</span>
      </div>
      <div className="stat">
        <span className="stat-num">{summary.diapers}</span>
        <span className="stat-label">Diapers</span>
      </div>
    </section>
  )
}
