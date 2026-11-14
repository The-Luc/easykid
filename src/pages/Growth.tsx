import { useState } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import PageHead from '../components/PageHead'
import Chips from '../components/Chips'
import MeasurementSheet from '../components/MeasurementSheet'
import AppointmentSheet from '../components/AppointmentSheet'
import { useNow, useStore } from '../lib/hooks'
import {
  appointmentActions,
  appointmentStore,
  growthStore,
} from '../lib/stores'
import type { Appointment, Measurement } from '../types'

type Key = 'weightKg' | 'lengthCm' | 'headCm'

const METRICS: { key: Key; label: string; unit: string; decimals: number }[] = [
  { key: 'weightKg', label: 'Weight', unit: 'kg', decimals: 2 },
  { key: 'lengthCm', label: 'Length', unit: 'cm', decimals: 1 },
  { key: 'headCm', label: 'Head', unit: 'cm', decimals: 1 },
]

const TICK = { fill: 'var(--ink-2)', fontSize: 12 }
const TOOLTIP = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  color: 'var(--ink)',
}

function relative(days: number) {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days > 1) return `In ${days} days`
  return `${-days} ${days === -1 ? 'day' : 'days'} overdue`
}

export default function Growth() {
  const measurements = useStore(growthStore)
  const appointments = useStore(appointmentStore)
  const now = useNow(60_000)

  const [metricKey, setMetricKey] = useState<Key>('weightKg')
  const [measSheet, setMeasSheet] = useState<{ measurement?: Measurement } | null>(null)
  const [apptSheet, setApptSheet] = useState<{ appointment?: Appointment } | null>(null)

  const metric = METRICS.find((m) => m.key === metricKey)!
  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date))

  const latestOf = (k: Key) => {
    const pts = sorted.filter((m) => m[k] !== undefined)
    const last = pts.at(-1)?.[k]
    const prev = pts.at(-2)?.[k]
    return { last, delta: last !== undefined && prev !== undefined ? last - prev : undefined }
  }

  const points = sorted
    .filter((m) => m[metricKey] !== undefined)
    .map((m) => ({
      label: format(parseISO(m.date), 'MMM d'),
      value: m[metricKey] as number,
    }))

  const upcoming = appointments
    .filter((a) => !a.done)
    .sort((a, b) => a.date.localeCompare(b.date))
  const past = appointments
    .filter((a) => a.done)
    .sort((a, b) => b.date.localeCompare(a.date))

  const summary = (m: Measurement) =>
    METRICS.filter((x) => m[x.key] !== undefined)
      .map((x) => `${(m[x.key] as number).toFixed(x.decimals)} ${x.unit}`)
      .join(' · ')

  const renderAppointment = (a: Appointment) => {
    const days = differenceInCalendarDays(parseISO(a.date), now)
    return (
      <li key={a.id} className="appt">
        <button
          type="button"
          className={`check${a.done ? ' on' : ''}`}
          aria-label={a.done ? `Mark ${a.title} as not done` : `Mark ${a.title} as done`}
          aria-pressed={a.done}
          onClick={() => appointmentActions.setDone(a.id, !a.done)}
        >
          {a.done ? '✓' : ''}
        </button>
        <button
          type="button"
          className="appt-main"
          aria-label={`Edit ${a.title}`}
          onClick={() => setApptSheet({ appointment: a })}
        >
          <span className="appt-title">
            {a.kind === 'vaccine' ? '💉' : '🩺'} {a.title}
          </span>
          <span className={`appt-sub${!a.done && days < 0 ? ' overdue' : ''}`}>
            {format(parseISO(a.date), 'EEE, MMM d')}
            {!a.done && ` · ${relative(days)}`}
          </span>
        </button>
      </li>
    )
  }

  return (
    <>
      <PageHead eyebrow="Health" title="Growth" />
      <div className="stack">
        {/* Latest values */}
        <section className="highlights three">
          {METRICS.map((m) => {
            const { last, delta } = latestOf(m.key)
            return (
              <div key={m.key} className="stat">
                <span className="stat-num">
                  {last === undefined ? '–' : last.toFixed(m.decimals)}
                </span>
                <span className="stat-label">
                  {m.label} {m.unit}
                </span>
                {delta !== undefined && (
                  <span className={`delta${delta < 0 ? ' down' : ''}`}>
                    {delta >= 0 ? '+' : '−'}
                    {Math.abs(delta).toFixed(m.decimals)}
                  </span>
                )}
              </div>
            )
          })}
        </section>

        {/* Chart */}
        <section className="card">
          <h2>Trend</h2>
          <Chips
            options={METRICS.map((m) => ({ value: m.key, label: m.label }))}
            value={metricKey}
            onChange={(k) => k && setMetricKey(k)}
          />
          {points.length >= 2 ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 14, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} interval="preserveStartEnd" />
                  <YAxis tickLine={false} axisLine={false} tick={TICK} width={44} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={TOOLTIP} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={`${metric.label} (${metric.unit})`}
                    stroke="var(--sleep)"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="muted chart-empty">
              Add at least two {metric.label.toLowerCase()} measurements to see the trend.
            </p>
          )}
        </section>

        {/* Measurements */}
        <section className="card">
          <div className="card-head">
            <h2>Measurements</h2>
            <button type="button" className="btn-pill sm" onClick={() => setMeasSheet({})}>
              + Add
            </button>
          </div>
          {sorted.length === 0 ? (
            <p className="muted">No measurements yet.</p>
          ) : (
            <ul className="events">
              {[...sorted].reverse().map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="event plain"
                    aria-label={`Edit measurement from ${m.date}`}
                    onClick={() => setMeasSheet({ measurement: m })}
                  >
                    <span className="event-main">
                      <span className="event-title">
                        {format(parseISO(m.date), 'EEE, MMM d, yyyy')}
                      </span>
                      <span className="event-sub">{summary(m)}</span>
                    </span>
                    <span className="event-chev" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Appointments */}
        <section className="card">
          <div className="card-head">
            <h2>Upcoming</h2>
            <button type="button" className="btn-pill sm" onClick={() => setApptSheet({})}>
              + Add
            </button>
          </div>
          {upcoming.length === 0 ? (
            <p className="muted">No upcoming vaccines or visits.</p>
          ) : (
            <ul className="appts">{upcoming.map(renderAppointment)}</ul>
          )}
        </section>

        {past.length > 0 && (
          <section className="card">
            <h2>Done ✓</h2>
            <ul className="appts">{past.map(renderAppointment)}</ul>
          </section>
        )}
      </div>

      {measSheet && (
        <MeasurementSheet
          key={measSheet.measurement?.id ?? 'new'}
          measurement={measSheet.measurement}
          latest={{
            weightKg: latestOf('weightKg').last,
            lengthCm: latestOf('lengthCm').last,
            headCm: latestOf('headCm').last,
          }}
          onClose={() => setMeasSheet(null)}
        />
      )}
      {apptSheet && (
        <AppointmentSheet
          key={apptSheet.appointment?.id ?? 'new'}
          appointment={apptSheet.appointment}
          onClose={() => setApptSheet(null)}
        />
      )}
    </>
  )
}
