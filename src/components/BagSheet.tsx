import { useState } from 'react'
import { format } from 'date-fns'
import Chips from './Chips'
import Sheet from './Sheet'
import TimeField from './TimeField'
import WheelField from './WheelField'
import { bagActions } from '../lib/stores'
import type { MilkBag } from '../types'

const LOCATIONS: { value: MilkBag['location']; label: string }[] = [
  { value: 'freezer', label: '🧊 Freezer' },
  { value: 'fridge', label: 'Fridge' },
]

/** Add a bag by hand (for example milk stored before you started the app), or edit one. */
export default function BagSheet({
  bag,
  onClose,
}: {
  bag?: MilkBag
  onClose: () => void
}) {
  const editing = bag !== undefined
  const [volume, setVolume] = useState(bag?.volumeMl ?? 100)
  const [location, setLocation] = useState<MilkBag['location']>(bag?.location ?? 'freezer')
  const [today] = useState(() => format(Date.now(), 'yyyy-MM-dd'))
  const [pumpedAt, setPumpedAt] = useState(() => bag?.pumpedAt ?? Date.now())
  const [notes, setNotes] = useState(bag?.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // The time wheels keep the day; this picks the day (never later than now)
  const changeDay = (value: string) => {
    if (!value) return
    const [y, m, d] = value.split('-').map(Number)
    const next = new Date(pumpedAt)
    next.setFullYear(y, m - 1, d)
    setPumpedAt(Math.min(next.getTime(), Date.now()))
  }

  const save = () => {
    const payload = {
      pumpedAt,
      volumeMl: volume,
      location,
      ...(bag?.discardedAt !== undefined ? { discardedAt: bag.discardedAt } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    }
    if (bag) bagActions.update(bag.id, payload)
    else bagActions.add(payload)
    onClose()
  }

  const remove = () => {
    if (!bag) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    bagActions.remove(bag.id)
    onClose()
  }

  return (
    <Sheet title={editing ? 'Edit bag' : 'Add bag'} onClose={onClose}>
      <div className="sheet-body">
        <WheelField
          label="Volume"
          value={volume}
          max={500}
          step={5}
          unit="ml"
          onChange={setVolume}
        />

        <div className="field">
          <span className="field-label">Stored in</span>
          <Chips
            options={LOCATIONS}
            value={location}
            onChange={(v) => v && setLocation(v)}
          />
        </div>

        <div className="field">
          <span className="field-label">Pumped on</span>
          <input
            className="date-input"
            type="date"
            max={today}
            value={format(pumpedAt, 'yyyy-MM-dd')}
            onChange={(e) => changeDay(e.target.value)}
          />
        </div>

        <TimeField label="Pumped at" value={pumpedAt} onChange={setPumpedAt} />

        <input
          className="input"
          type="text"
          placeholder="Note (optional)"
          aria-label="Note"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="sheet-foot">
        <button type="button" className="btn btn-primary" onClick={save}>
          {editing ? 'Save changes' : 'Add bag'}
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
