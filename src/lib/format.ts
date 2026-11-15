import { format, isToday, isYesterday } from 'date-fns'

/** Running timer: 12:34 or 1:02:03 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`
  return `${m}:${ss}`
}

/** Short duration: 45m or 1h 20m */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatTime(ms: number): string {
  return format(ms, 'h:mm a')
}

/** "today 7:10 AM", "yesterday 10:40 PM", "Sat 7:05 AM" */
export function formatWhen(ms: number): string {
  const day = isToday(ms) ? 'today' : isYesterday(ms) ? 'yesterday' : format(ms, 'EEE d MMM')
  return `${day} ${format(ms, 'h:mm a')}`
}
