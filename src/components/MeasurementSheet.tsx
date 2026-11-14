import { useState } from 'react'
import { format } from 'date-fns'
import Chips from './Chips'
import Sheet from './Sheet'
import WheelField from './WheelField'
import { growthActions, isoDate } from '../lib/stores'
import type { Measurement } from '../types'

type Key = 'weightKg' | 'lengthCm' | 'headCm'

const METRICS: {
  key: Key
  label: string
  unit: string
  max: number
  step: number
  decimals: number
  typical: number
}[] = [
  { key: 'weightKg', label: 'Weight', unit: 'kg', max: 20, step: 0.05, decimals: 2, typical: 3.5 },
  { key: 'lengthCm', label: 'Length', unit: 'cm', max: 120, step: 0.5, decimals: 1, typical: 50 },
  { key: 'headCm', label: 'Head', unit: 'cm', max: 60, step: 0.5, decimals: 1, typical: 35 },
]

type Values = Partial<Record<Key, number>>

/** Add or edit a growth measurement. Each of weight / length / head is optional. */
export default function MeasurementSheet({
  measurement,
  latest,
  onClose,
}: {
  measurement?: Measurement
  /** Most recent values, used as starting points for the wheels */
  latest: Values
  onClose: () => void
}) {
  const editing = measurement !== undefined
  const [today] = useState(() => isoDate(Date.now()))
  const [date, setDate] = useState(measurement?.date ?? today)
  const [values, setValues] = useState<Values>(() =>
    measurement
      ? {
          weightKg: measurement.weightKg,
          lengthCm: measurement.lengthCm,
          headCm: measurement.headCm,
        }
      : { weightKg: latest.weightKg ?? 3.5 },
  )
  const [active, setActive] = useState<Key>(
    METRICS.find((m) => measurement?.[m.key] !== undefined)?.key ?? 'weightKg',
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  const metric = METRICS.find((m) => m.key === active)!
  const current = values[active]
  const hasAny = METRICS.some((m) => values[m.key] !== undefined)

  const setValue = (key: Key, v: number | undefined) =>
    setValues((prev) => ({ ...prev, [key]: v }))

  const save = () => {
    const payload = { date, ...values }
    if (measurement) growthActions.update(measurement.id, payload)
    else growthActions.add(payload)
    onClose()
  }

  const remove = () => {
    if (!measurement) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    growthActions.remove(measurement.id)
    onClose()
  }

  return (
    <Sheet title={editing ? 'Edit measurement' : 'Add measurement'} onClose={onClose}>
      <div className="sheet-body">
        <div className="field">
          <span className="field-label">Date</span>
          <input
            className="date-input"
            type="date"
            max={today}
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </div>

        <Chips
          options={METRICS.map((m) => ({
            value: m.key,
            label: `${m.label}${values[m.key] !== undefined ? ' ✓' : ''}`,
          }))}
          value={active}
          onChange={(k) => k && setActive(k)}
        />

        {current === undefined ? (
          <button
            type="button"
            className="btn btn-soft"
            onClick={() => setValue(active, latest[active] ?? metric.typical)}
          >
            + Add {metric.label.toLowerCase()}
          </button>
        ) : (
          <>
            <WheelField
              key={active}
              label={metric.label}
              value={current}
              max={metric.max}
              step={metric.step}
              decimals={metric.decimals}
              unit={metric.unit}
              onChange={(v) => setValue(active, v)}
            />
            <button
              type="button"
              className="link-btn centered"
              onClick={() => setValue(active, undefined)}
            >
              Remove {metric.label.toLowerCase()}
            </button>
          </>
        )}

        <p className="muted small centered">
          {format(new Date(`${date}T12:00:00`), 'EEEE, MMM d')}
        </p>
      </div>

      <div className="sheet-foot">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!hasAny}
          onClick={save}
        >
          {editing ? 'Save changes' : 'Add'}
        </button>
        {editing && (
          <button type="button" className="btn btn-danger" onClick={remove}>
            {confirmDelete ? 'Tap again to delete' : 'Delete'}
          </button>
        )}
      </div>
    </Sheet>
  )
}
