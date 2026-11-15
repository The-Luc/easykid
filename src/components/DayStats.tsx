import { formatDuration } from '../lib/format'
import type { DaySummary } from '../lib/events'

export default function DayStats({ summary }: { summary: DaySummary }) {
  // The pump card only appears on days you pumped
  const pumped = summary.pumps > 0

  return (
    <section className={`stats-row${pumped ? ' four' : ''}`}>
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
      {pumped && (
        <div className="stat">
          <span className="stat-num">{summary.pumpMl > 0 ? summary.pumpMl : summary.pumps}</span>
          <span className="stat-label">{summary.pumpMl > 0 ? 'ml pumped' : 'Pumps'}</span>
        </div>
      )}
    </section>
  )
}
