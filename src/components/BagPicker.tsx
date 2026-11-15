import { expiry, volumeOf } from '../lib/storage'
import { formatWhen } from '../lib/format'
import type { MilkBag } from '../types'

/**
 * Pick the stored bag(s) used for a feed. `bags` is the list on offer (newest first);
 * `selected` holds the ticked ids. Ticking is a plain toggle, so the order does not matter.
 */
export default function BagPicker({
  bags,
  selected,
  now,
  onChange,
}: {
  bags: MilkBag[]
  selected: string[]
  now: number
  onChange: (ids: string[]) => void
}) {
  if (bags.length === 0) {
    return (
      <p className="bag-empty">
        No bags in storage. Add them when you save a pump, or on the Storage page.
      </p>
    )
  }

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  const ticked = bags.filter((b) => selected.includes(b.id)).length

  return (
    <div className="bag-picker">
      <ul className="bag-list">
        {bags.map((b) => {
          const on = selected.includes(b.id)
          const ex = expiry(b, now)
          return (
            <li key={b.id}>
              <button
                type="button"
                className={`bag-row${on ? ' on' : ''}`}
                aria-pressed={on}
                onClick={() => toggle(b.id)}
              >
                <span className="bag-check" aria-hidden="true">
                  {on ? '✓' : ''}
                </span>
                <span className="bag-main">
                  <span className="bag-vol">{b.volumeMl} ml</span>
                  <span className="bag-sub">
                    pumped {formatWhen(b.pumpedAt)} · {b.location}
                  </span>
                </span>
                {ex.state !== 'ok' && (
                  <span className={`bag-badge ${ex.state}`}>
                    {ex.state === 'expired' ? 'Expired' : 'Use soon'}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {ticked > 0 && (
        <p className="bag-total">
          {ticked} bag{ticked === 1 ? '' : 's'} · {volumeOf(bags, selected)} ml
        </p>
      )}
    </div>
  )
}
