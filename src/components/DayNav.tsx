import { addDays, format, isToday, isYesterday } from 'date-fns'

/** ‹ Today › day switcher. The next arrow is disabled on today. */
export default function DayNav({
  day,
  onChange,
}: {
  day: Date
  onChange: (day: Date) => void
}) {
  const viewingToday = isToday(day)
  const label = viewingToday
    ? 'Today'
    : isYesterday(day)
      ? 'Yesterday'
      : format(day, 'EEE, MMM d')

  return (
    <div className="day-nav">
      <button
        type="button"
        className="icon-btn big"
        aria-label="Previous day"
        onClick={() => onChange(addDays(day, -1))}
      >
        ‹
      </button>
      <span className="day-label">{label}</span>
      <button
        type="button"
        className="icon-btn big"
        aria-label="Next day"
        disabled={viewingToday}
        onClick={() => onChange(addDays(day, 1))}
      >
        ›
      </button>
    </div>
  )
}
