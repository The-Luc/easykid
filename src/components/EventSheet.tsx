import { useState } from 'react'
import { format, isSameDay } from 'date-fns'
import Chips from './Chips'
import Sheet from './Sheet'
import TimeField from './TimeField'
import WheelField from './WheelField'
import { isPhase } from '../lib/events'
import { formatDuration, formatTime } from '../lib/format'
import { EVENT_EMOJI, EVENT_LABEL } from '../lib/meta'
import { eventStore } from '../lib/store'
import { clampDuration, resolveSpan, switchAnchor, type Anchor } from '../lib/times'
import type { BabyEvent, EventDetails, EventType } from '../types'

type Side = NonNullable<EventDetails['side']>
type Diaper = NonNullable<EventDetails['diaper']>

const ADD_TYPES: { value: EventType; label: string }[] = (
  ['eat', 'diaper', 'sleep', 'activity', 'you'] as const
).map((t) => ({ value: t, label: `${EVENT_EMOJI[t]} ${EVENT_LABEL[t]}` }))

const SIDES: { value: Side; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Both' },
  { value: 'bottle', label: '🍼 Bottle' },
]

const DIAPERS: { value: Diaper; label: string }[] = [
  { value: 'wet', label: '💧 Wet' },
  { value: 'dirty', label: '💩 Dirty' },
  { value: 'both', label: 'Both' },
]

const ANCHORS: { value: Anchor; label: string }[] = [
  { value: 'start', label: 'Started' },
  { value: 'end', label: 'Ended' },
]

const DEFAULT_DURATION: Record<EventType, number> = {
  eat: 15,
  sleep: 60,
  activity: 30,
  you: 30,
  diaper: 0,
}

/**
 * Bottom sheet to add a past entry, or edit an existing one.
 * For a phase that is still running only its start time is editable.
 */
export default function EventSheet({
  event,
  initialType,
  defaultEnd,
  onClose,
}: {
  event?: BabyEvent
  /** Type preselected for a new entry (for example when tapping the A or Y tile) */
  initialType?: EventType
  /** Initial time for a new entry (defaults to now) */
  defaultEnd?: number
  onClose: () => void
}) {
  const editing = event !== undefined
  const running = event !== undefined && event.endedAt === null && isPhase(event.type)

  const [type, setType] = useState<EventType>(event?.type ?? initialType ?? 'eat')
  // You set ONE time (the anchor: the start or the end) plus the duration, and the
  // other time is calculated. An existing entry opens on its start, which matches
  // the timer and the list; a new past entry opens on its end ("it just finished").
  const [anchor, setAnchor] = useState<Anchor>(event ? 'start' : 'end')
  const [anchorAt, setAnchorAt] = useState(() =>
    event ? event.startedAt : (defaultEnd ?? Date.now()),
  )
  const [capped, setCapped] = useState(false)
  const [duration, setDuration] = useState(() =>
    event && event.endedAt !== null
      ? Math.max(1, Math.round((event.endedAt - event.startedAt) / 60_000))
      : DEFAULT_DURATION[event?.type ?? initialType ?? 'eat'],
  )
  // Older entries may have ml without a side: that was a bottle
  const [side, setSide] = useState<Side | undefined>(
    event?.details.side ?? (event?.details.ml ? 'bottle' : undefined),
  )
  const [ml, setMl] = useState(event?.details.ml ?? 90)
  const [diaper, setDiaper] = useState<Diaper>(event?.details.diaper ?? 'wet')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [showNote, setShowNote] = useState(Boolean(event?.notes))
  const [confirmDelete, setConfirmDelete] = useState(false)

  const hasDuration = type !== 'diaper' && !running
  const timeLabel = running
    ? 'Started'
    : type === 'diaper'
      ? 'Time'
      : anchor === 'start'
        ? 'Started'
        : 'Ended'

  const durationMs = hasDuration ? duration * 60_000 : 0
  const span = resolveSpan(anchor, anchorAt, durationMs)

  const changeType = (t: EventType) => {
    setType(t)
    setDuration(DEFAULT_DURATION[t])
    setCapped(false)
  }

  // Changing the duration only ever moves the calculated time. When the start is the
  // anchor the entry may not end in the future, so the duration is capped.
  const changeDuration = (minutes: number) => {
    const next = clampDuration(anchor, anchorAt, minutes, Date.now())
    setCapped(next < Math.round(minutes))
    setDuration(next)
  }

  const changeAnchorAt = (ms: number) => {
    setAnchorAt(ms)
    const next = clampDuration(anchor, ms, duration, Date.now())
    setCapped(next < duration)
    setDuration(next)
  }

  // Switch which end you set; the entry itself stays exactly the same
  const changeAnchor = (next: Anchor) => {
    if (next === anchor) return
    setAnchorAt(switchAnchor(anchor, anchorAt, durationMs))
    setAnchor(next)
    setCapped(false)
  }

  const otherLabel = anchor === 'start' ? 'Ends' : 'Started'
  const otherAt = anchor === 'start' ? span.endedAt : span.startedAt
  const otherText = isSameDay(otherAt, anchorAt)
    ? formatTime(otherAt)
    : `${format(otherAt, 'EEE')} ${formatTime(otherAt)}`

  const save = () => {
    const details: EventDetails = {}
    if (type === 'eat' && side) {
      details.side = side
      if (side === 'bottle') details.ml = ml
    }
    if (type === 'diaper') details.diaper = diaper
    const note = notes.trim() || undefined

    if (event && running) {
      eventStore.update(event.id, { startedAt: anchorAt, details, notes: note })
    } else {
      const payload = {
        type,
        startedAt: span.startedAt,
        endedAt: span.endedAt,
        details,
        notes: note,
      }
      if (event) eventStore.update(event.id, payload)
      else eventStore.add(payload)
    }
    onClose()
  }

  const remove = () => {
    if (!event) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    eventStore.remove(event.id)
    onClose()
  }

  return (
    <Sheet
      title={editing ? `Edit ${EVENT_LABEL[type].toLowerCase()}` : 'Add entry'}
      onClose={onClose}
    >
        <div className="sheet-body">
          {!editing && (
            <Chips options={ADD_TYPES} value={type} onChange={(v) => v && changeType(v)} />
          )}

          {type === 'eat' && (
            <div className="field">
              <span className="field-label">How</span>
              <Chips options={SIDES} value={side} onChange={setSide} clearable />
            </div>
          )}

          {type === 'eat' && side === 'bottle' && (
            <WheelField
              label="Amount"
              value={ml}
              max={400}
              step={5}
              unit="ml"
              onChange={setMl}
            />
          )}

          {type === 'diaper' && (
            <div className="field">
              <span className="field-label">Type</span>
              <Chips options={DIAPERS} value={diaper} onChange={(v) => v && setDiaper(v)} />
            </div>
          )}

          {hasDuration && (
            <WheelField
              label="How long"
              value={duration}
              max={type === 'eat' ? 90 : 720}
              step={type === 'eat' ? 1 : 5}
              unit="min"
              hint={duration >= 60 ? `= ${formatDuration(duration * 60_000)}` : undefined}
              onChange={changeDuration}
            />
          )}

          {hasDuration && (
            <div className="field">
              <span className="field-label">Which time do you know?</span>
              <Chips
                options={ANCHORS}
                value={anchor}
                onChange={(a) => a && changeAnchor(a)}
              />
            </div>
          )}

          <TimeField label={timeLabel} value={anchorAt} onChange={changeAnchorAt} />

          {hasDuration && (
            <p className="calc-line">
              {otherLabel} <strong>{otherText}</strong> · calculated from the duration
              {capped && ' · capped so it does not end in the future'}
            </p>
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
          <button type="button" className="btn btn-primary" onClick={save}>
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
