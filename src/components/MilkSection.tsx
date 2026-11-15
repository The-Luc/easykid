import Chips from './Chips'
import BagPicker from './BagPicker'
import type { EventDetails, MilkBag } from '../types'

type Milk = NonNullable<EventDetails['milk']>

const MILK: { value: Milk; label: string }[] = [
  { value: 'formula', label: 'Formula' },
  { value: 'pumped', label: 'Pumped milk' },
]

/**
 * What is in the bottle: formula, or pumped breast milk (and which stored bag(s) it came
 * from). Shown whenever a feed's side is "Bottle", in the Add/Edit sheet and on the
 * running Eat card.
 */
export default function MilkSection({
  milk,
  bagIds,
  bags,
  now,
  onMilk,
  onBags,
}: {
  milk: Milk | undefined
  bagIds: string[]
  /** bags that can be picked, newest first */
  bags: MilkBag[]
  now: number
  onMilk: (milk: Milk | undefined) => void
  onBags: (ids: string[]) => void
}) {
  return (
    <div className="milk-section">
      <span className="field-label">Milk</span>
      <Chips options={MILK} value={milk} onChange={onMilk} clearable />
      {milk === 'pumped' && (
        <>
          <span className="field-label">From storage (optional)</span>
          <BagPicker bags={bags} selected={bagIds} now={now} onChange={onBags} />
        </>
      )}
    </div>
  )
}
