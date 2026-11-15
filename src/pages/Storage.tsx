import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BagSheet from '../components/BagSheet'
import EventSheet from '../components/EventSheet'
import PageHead from '../components/PageHead'
import { formatWhen } from '../lib/format'
import { useEvents, useNow, useStore } from '../lib/hooks'
import {
  discardedBags,
  expiry,
  stashSummary,
  storedBags,
  usedBags,
} from '../lib/storage'
import { bagActions, bagStore } from '../lib/stores'
import type { MilkBag } from '../types'

export default function Storage() {
  const bags = useStore(bagStore)
  const events = useEvents()
  const now = useNow(60_000)

  const [bagSheet, setBagSheet] = useState<{ bag?: MilkBag } | null>(null)
  const [useBag, setUseBag] = useState<MilkBag | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState<string | null>(null)
  const [showUsed, setShowUsed] = useState(false)

  // "Tap again to throw away" goes back after a few seconds
  useEffect(() => {
    if (!confirmDiscard) return
    const t = setTimeout(() => setConfirmDiscard(null), 4000)
    return () => clearTimeout(t)
  }, [confirmDiscard])

  const stored = storedBags(bags, events) // newest first
  const summary = stashSummary(bags, events, now)
  const used = usedBags(bags, events)
  const thrown = discardedBags(bags, events)

  const expired = stored.filter((b) => expiry(b, now).state === 'expired').length
  const soon = stored.filter((b) => expiry(b, now).state === 'soon').length

  const discard = (id: string, at: number) => {
    if (confirmDiscard === id) {
      bagActions.discard(id, at)
      setConfirmDiscard(null)
    } else {
      setConfirmDiscard(id)
    }
  }

  const sections = [
    { key: 'freezer', title: '🧊 Freezer', list: stored.filter((b) => b.location === 'freezer'), totals: summary.freezer },
    { key: 'fridge', title: 'Fridge', list: stored.filter((b) => b.location === 'fridge'), totals: summary.fridge },
  ]

  return (
    <>
      <PageHead
        eyebrow="Milk storage"
        title="Stash"
        action={
          <div className="head-actions">
            <Link to="/" className="btn-pill ghost">
              ‹ Today
            </Link>
            <button type="button" className="btn-pill" onClick={() => setBagSheet({})}>
              + Add bag
            </button>
          </div>
        }
      />

      <div className="stack">
        <section className="card stash-summary">
          <p className="stash-main">
            {summary.bags} bag{summary.bags === 1 ? '' : 's'} · {summary.ml} ml
          </p>
          <p className="muted small">
            {summary.freezer.bags} in the freezer · {summary.fridge.bags} in the fridge
            {expired > 0 && ` · ⚠ ${expired} past use-by`}
            {expired === 0 && soon > 0 && ` · ${soon} to use soon`}
          </p>
        </section>

        {stored.length === 0 && (
          <section className="card">
            <p className="muted">
              Nothing in storage yet. When you save a pump, choose where it goes, or add a bag
              by hand.
            </p>
          </section>
        )}

        {sections
          .filter((s) => s.list.length > 0)
          .map((s) => (
            <section key={s.key} className="card">
              <h2>
                {s.title} · {s.totals.bags} bag{s.totals.bags === 1 ? '' : 's'} · {s.totals.ml} ml
              </h2>
              <ul className="stash-list">
                {s.list.map((b) => {
                  const ex = expiry(b, now)
                  return (
                    <li key={b.id} className="stash-bag">
                      <button
                        type="button"
                        className="stash-bag-main"
                        aria-label={`Edit the ${b.volumeMl} ml bag pumped ${formatWhen(b.pumpedAt)}`}
                        onClick={() => setBagSheet({ bag: b })}
                      >
                        <span className="bag-vol">{b.volumeMl} ml</span>
                        <span className="bag-sub">pumped {formatWhen(b.pumpedAt)}</span>
                        <span className={`bag-useby ${ex.state}`}>
                          {ex.state === 'expired'
                            ? 'Past use-by'
                            : ex.state === 'soon'
                              ? `Use soon · ${ex.daysLeft <= 1 ? 'by tomorrow' : `${ex.daysLeft} days left`}`
                              : `Use by ${formatWhen(ex.useBy).replace(/ \d+:\d+ [AP]M$/, '')}`}
                        </span>
                      </button>
                      <div className="stash-actions">
                        <button type="button" className="btn-pill sm" onClick={() => setUseBag(b)}>
                          Use
                        </button>
                        <button
                          type="button"
                          className="btn-pill sm ghost"
                          onClick={() => discard(b.id, Date.now())}
                        >
                          {confirmDiscard === b.id ? 'Tap again to throw away' : 'Throw away'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}

        {(used.length > 0 || thrown.length > 0) && (
          <section className="card">
            <button
              type="button"
              className="link-btn"
              aria-expanded={showUsed}
              onClick={() => setShowUsed(!showUsed)}
            >
              {showUsed ? '▾' : '▸'} Used and thrown away ({used.length + thrown.length})
            </button>
            {showUsed && (
              <ul className="stash-list history">
                {used.map(({ bag, usedAt }) => (
                  <li key={bag.id} className="stash-bag compact">
                    <span className="bag-vol">{bag.volumeMl} ml</span>
                    <span className="bag-sub">
                      pumped {formatWhen(bag.pumpedAt)} · used {formatWhen(usedAt)}
                    </span>
                  </li>
                ))}
                {thrown.map((bag) => (
                  <li key={bag.id} className="stash-bag compact">
                    <span className="bag-vol">{bag.volumeMl} ml</span>
                    <span className="bag-sub">
                      pumped {formatWhen(bag.pumpedAt)} · thrown away{' '}
                      {bag.discardedAt ? formatWhen(bag.discardedAt) : ''}
                    </span>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => bagActions.restore(bag.id)}
                    >
                      Put back
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {bagSheet && (
        <BagSheet
          key={bagSheet.bag?.id ?? 'new'}
          bag={bagSheet.bag}
          onClose={() => setBagSheet(null)}
        />
      )}

      {/* "Use" logs a bottle feed of pumped milk with this bag already ticked */}
      {useBag && (
        <EventSheet
          key={`use-${useBag.id}`}
          initialType="eat"
          initialDetails={{
            side: 'bottle',
            milk: 'pumped',
            bagIds: [useBag.id],
            ml: useBag.volumeMl,
          }}
          onClose={() => setUseBag(null)}
        />
      )}
    </>
  )
}
