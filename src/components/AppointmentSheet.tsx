import { useState } from 'react'
import Chips from './Chips'
import Sheet from './Sheet'
import { appointmentActions, isoDate } from '../lib/stores'
import type { Appointment } from '../types'

const KINDS = [
  { value: 'vaccine' as const, label: '💉 Vaccine' },
  { value: 'visit' as const, label: '🩺 Visit' },
]

const QUICK: Record<Appointment['kind'], string[]> = {
  vaccine: ['Hep B', '2-month shots', '4-month shots', '6-month shots'],
  visit: ['Checkup', 'Weight check', 'Sick visit'],
}

const STATUS = [
  { value: 'todo' as const, label: 'To do' },
  { value: 'done' as const, label: 'Done ✓' },
]

/** Add or edit a vaccine or doctor visit. Quick-pick chips avoid typing. */
export default function AppointmentSheet({
  appointment,
  onClose,
}: {
  appointment?: Appointment
  onClose: () => void
}) {
  const editing = appointment !== undefined
  const [kind, setKind] = useState<Appointment['kind']>(appointment?.kind ?? 'vaccine')
  const [title, setTitle] = useState(appointment?.title ?? '')
  const [date, setDate] = useState(() => appointment?.date ?? isoDate(Date.now()))
  const [done, setDone] = useState(appointment?.done ?? false)
  const [notes, setNotes] = useState(appointment?.notes ?? '')
  const [showNote, setShowNote] = useState(Boolean(appointment?.notes))
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = () => {
    const payload = {
      kind,
      title: title.trim(),
      date,
      done,
      notes: notes.trim() || undefined,
    }
    if (appointment) appointmentActions.update(appointment.id, payload)
    else appointmentActions.add(payload)
    onClose()
  }

  const remove = () => {
    if (!appointment) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    appointmentActions.remove(appointment.id)
    onClose()
  }

  return (
    <Sheet title={editing ? 'Edit appointment' : 'Add appointment'} onClose={onClose}>
      <div className="sheet-body">
        <Chips options={KINDS} value={kind} onChange={(k) => k && setKind(k)} />

        <div className="field">
          <span className="field-label">What</span>
          <Chips
            options={QUICK[kind].map((t) => ({ value: t, label: t }))}
            value={title}
            onChange={(t) => t && setTitle(t)}
          />
          <input
            className="input"
            type="text"
            placeholder="Or type a name"
            aria-label="Appointment name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="field">
          <span className="field-label">Date</span>
          <input
            className="date-input"
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </div>

        {editing && (
          <Chips
            options={STATUS}
            value={done ? 'done' : 'todo'}
            onChange={(s) => s && setDone(s === 'done')}
          />
        )}

        {showNote ? (
          <input
            className="input"
            type="text"
            placeholder="Add a note (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        ) : (
          <button type="button" className="link-btn" onClick={() => setShowNote(true)}>
            + Add note
          </button>
        )}
      </div>

      <div className="sheet-foot">
        <button
          type="button"
          className="btn btn-primary"
          disabled={title.trim() === ''}
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
