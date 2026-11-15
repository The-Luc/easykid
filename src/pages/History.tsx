import { useState } from 'react'
import { addHours, isToday, startOfDay } from 'date-fns'
import PageHead from '../components/PageHead'
import DayNav from '../components/DayNav'
import DayStats from '../components/DayStats'
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
        <DayNav day={day} onChange={setDay} />
        <DayStats summary={summary} />
        <section className="card">
          <EventList
            events={list}
            now={now}
            empty="No entries for this day"
            onSelect={(event) => setSheet({ event })}
          />
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
