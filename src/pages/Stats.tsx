import { useState, type ReactElement } from 'react'
import { format, startOfDay } from 'date-fns'
import {
  Bar,
  BarChart,
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
import DayNav from '../components/DayNav'
import Timeline from '../components/Timeline'
import { formatDuration } from '../lib/format'
import { useEvents, useNow } from '../lib/hooks'
import { dailyTotals, feedGapsByDay, highlights } from '../lib/stats'

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
]

const TICK = { fill: 'var(--ink-2)', fontSize: 12 }
const TOOLTIP = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  color: 'var(--ink)',
}
const MARGIN = { top: 8, right: 4, left: -18, bottom: 0 }

const oneDecimal = (n: number) => Math.round(n * 10) / 10

function ChartCard({ title, children }: { title: string; children: ReactElement }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default function Stats() {
  const events = useEvents()
  const now = useNow(60_000)
  const [range, setRange] = useState(7)
  const [day, setDay] = useState(() => startOfDay(Date.now()))

  const hl = highlights(events, now, range)
  const gaps = feedGapsByDay(events, now, range)
  const label = (d: number) => format(d, range === 7 ? 'EEE' : 'd')

  const totals = dailyTotals(events, now, range)
  const sleepData = totals.map((t) => ({
    label: label(t.day),
    sleep: oneDecimal(t.sleepMs / 3_600_000),
    feeds: t.feeds,
    pump: t.pumpMl,
  }))
  const hasPump = totals.some((t) => t.pumps > 0)
  const gapData = gaps.map((g) => ({
    label: label(g.day),
    gap: g.gapMs === null ? null : oneDecimal(g.gapMs / 3_600_000),
  }))

  const cards = [
    { label: 'Feeds / day', value: hl.avgFeeds.toFixed(1) },
    { label: 'Between feeds', value: hl.avgGapMs ? formatDuration(hl.avgGapMs) : '–' },
    { label: 'Sleep / day', value: formatDuration(hl.avgSleepMs) },
    { label: 'Longest sleep', value: formatDuration(hl.longestSleepMs) },
    ...(hl.avgMl > 0 ? [{ label: 'Bottle / day', value: `${Math.round(hl.avgMl)} ml` }] : []),
    ...(hl.avgPumps > 0
      ? [
          { label: 'Pumps / day', value: hl.avgPumps.toFixed(1) },
          { label: 'Pumped / day', value: `${Math.round(hl.avgPumpMl)} ml` },
          {
            label: 'Per session',
            value: hl.avgPumpSessionMl ? `${Math.round(hl.avgPumpSessionMl)} ml` : '–',
          },
          { label: 'Pump time', value: hl.avgPumpMs ? formatDuration(hl.avgPumpMs) : '–' },
          {
            label: 'Between pumps',
            value: hl.avgPumpGapMs ? formatDuration(hl.avgPumpGapMs) : '–',
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHead eyebrow="Patterns" title="Stats" />
      <div className="stack">
        <Chips options={RANGES} value={range} onChange={(v) => v && setRange(v)} />

        {hl.daysCounted === 0 ? (
          <section className="card">
            <p className="muted">Log a few feeds and sleeps to see trends here.</p>
          </section>
        ) : (
          <>
            <section className="highlights">
              {cards.map((c) => (
                <div key={c.label} className="stat">
                  <span className="stat-num">{c.value}</span>
                  <span className="stat-label">{c.label}</span>
                </div>
              ))}
            </section>

            <ChartCard title="Sleep per day (hours)">
              <BarChart data={sleepData} margin={MARGIN}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} tick={TICK} width={40} />
                <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={TOOLTIP} />
                <Bar dataKey="sleep" name="Sleep (h)" fill="var(--sleep)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Feeds per day">
              <BarChart data={sleepData} margin={MARGIN}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} tick={TICK} width={40} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={TOOLTIP} />
                <Bar dataKey="feeds" name="Feeds" fill="var(--eat)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartCard>

            {hasPump && (
              <ChartCard title="Pumped per day (ml)">
                <BarChart data={sleepData} margin={MARGIN}>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} interval="preserveStartEnd" />
                  <YAxis tickLine={false} axisLine={false} tick={TICK} width={40} />
                  <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={TOOLTIP} />
                  <Bar dataKey="pump" name="Pumped (ml)" fill="var(--pump)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartCard>
            )}

            <ChartCard title="Time between feeds (hours)">
              <LineChart data={gapData} margin={MARGIN}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} tick={TICK} width={40} domain={[0, 'auto']} />
                <Tooltip contentStyle={TOOLTIP} />
                <Line
                  type="monotone"
                  dataKey="gap"
                  name="Gap (h)"
                  stroke="var(--activity)"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ChartCard>
          </>
        )}

        <section className="card">
          <h2>Day timeline</h2>
          <DayNav day={day} onChange={setDay} />
          <Timeline events={events} day={day.getTime()} now={now} />
        </section>
      </div>
    </>
  )
}
