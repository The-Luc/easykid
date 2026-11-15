import { useState } from 'react'
import { addHours, isToday, startOfDay } from 'date-fns'
import PageHead from '../components/PageHead'
import DayNav from '../components/DayNav'
import DayStats, { FILTER_LABEL } from '../components/DayStats'
import { useStatFilter } from '../lib/useStatFilter'
import EventList from '../components/EventList'
import EventSheet from '../components/EventSheet'
import { withDerived } from '../lib/awake'
import { daySummary, eventsOnDay } from '../lib/events'
import { useEvents, useNow } from '../lib/hooks'
import type { BabyEvent } from '../types'

export default function History() {
  const events = useEvents()
  const now = useNow(30_000)
  const [day, setDay] = useState(() => startOfDay(Date.now()))
  const [sheet, setSheet] = useState<{ event?: BabyEvent } | null>(null)

  // calculated activity is included for display only
  const list = eventsOnDay(withDerived(events, now), day.getTime())
  const summary = daySummary(events, day.getTime(), now)
  const activityMs = list
    .filter((e) => e.type === 'activity')
    .reduce((sum, e) => sum + ((e.endedAt ?? now) - e.startedAt), 0)
  const { filter, toggle, reset, listRef, lockedHeight } = useStatFilter()
  const shown = filter ? list.filter((e) => e.type === filter) : list

  return (
    <>
      <PageHead
        eyebrow="Browse & edit"
        title="History"
        action={
          <button type="button" className="btn-pill" onClick={() => setSheet({})}>
            + Add
          </button>
        }
      />

      <div className="stack">
        <DayNav
          day={day}
          onChange={(d) => {
            // A filter such as Pump may not exist on the new day
            reset()
            setDay(d)
          }}
        />
        <DayStats summary={summary} activityMs={activityMs} active={filter} onToggle={toggle} />
        <section className="card">
          <div ref={listRef} style={{ minHeight: lockedHeight }}>
            <EventList
              events={shown}
              now={now}
              empty={
                filter
                  ? `No ${FILTER_LABEL[filter].toLowerCase()} on this day`
                  : 'No entries for this day'
              }
              onSelect={(event) => setSheet({ event })}
            />
          </div>
        </section>
      </div>

      {sheet && (
        <EventSheet
          key={sheet.event?.id ?? 'new'}
          event={sheet.event}
          // New entries on a past day start at noon of that day
          defaultEnd={isToday(day) ? undefined : addHours(day, 12).getTime()}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  )
}
