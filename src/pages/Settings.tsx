import { useRef, useState, type ChangeEvent } from 'react'
import { format } from 'date-fns'
import AccountCard from '../components/AccountCard'
import PageHead from '../components/PageHead'
import { ageLabel } from '../lib/age'
import { cloudStore } from '../lib/cloud'
import { buildBackup, parseBackup, type Backup } from '../lib/backup'
import { useEvents, useNow, useStore } from '../lib/hooks'
import { eventStore } from '../lib/store'
import {
  appointmentStore,
  bagStore,
  growthStore,
  isoDate,
  profileStore,
} from '../lib/stores'
import type { Profile } from '../types'

export default function Settings() {
  const profile = useStore(profileStore)
  const cloud = useStore(cloudStore)
  const events = useEvents()
  const growth = useStore(growthStore)
  const appointments = useStore(appointmentStore)
  const bags = useStore(bagStore)
  const now = useNow(60_000)

  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Backup | null>(null)
  const [importError, setImportError] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  const age = ageLabel(profile.birthDate, now)
  const update = (patch: Partial<Profile>) => profileStore.set({ ...profile, ...patch })

  const exportData = () => {
    const backup = buildBackup({ events, profile, growth, appointments, bags }, Date.now())
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `easykid-backup-${isoDate(Date.now())}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const result = parseBackup(await file.text())
    if (result.ok) {
      setPending(result.backup)
      setImportError('')
    } else {
      setPending(null)
      setImportError(result.error)
    }
  }

  const applyImport = () => {
    if (!pending) return
    eventStore.replaceAll(pending.events)
    profileStore.set(pending.profile)
    growthStore.set(pending.growth)
    appointmentStore.set(pending.appointments)
    bagStore.set(pending.bags)
    setPending(null)
  }

  const clearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    eventStore.replaceAll([])
    growthStore.set([])
    appointmentStore.set([])
    bagStore.set([])
    profileStore.set({ name: '', birthDate: '' })
    setConfirmClear(false)
  }

  return (
    <>
      <PageHead eyebrow="Your baby" title="Settings" />
      <div className="stack">
        <AccountCard />

        <section className="card form">
          <h2>Baby 👶</h2>
          <label className="field">
            <span className="field-label">Name</span>
            <input
              className="input"
              type="text"
              placeholder="Baby's name"
              value={profile.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">Birth date</span>
            <input
              className="date-input"
              type="date"
              max={isoDate(now)}
              value={profile.birthDate}
              onChange={(e) => update({ birthDate: e.target.value })}
            />
          </label>
          <p className="muted small">
            {age
              ? `${profile.name || 'Baby'} is ${age} old. Feed predictions use this age.`
              : 'Set the birth date so feed predictions match your baby’s age.'}
          </p>
        </section>

        <section className="card form">
          <h2>Your data 💾</h2>
          <p className="muted small">
            {cloud.phase === 'ready'
              ? 'Your data is saved on this phone and synced to the cloud. A backup file is an extra safety copy.'
              : 'Your data is stored on this device only. Export a backup now and then, or to move to a new phone.'}{' '}
            {events.length} entries, {growth.length} measurements and{' '}
            {appointments.length} appointments saved.
          </p>
          <div className="row-2">
            <button type="button" className="btn btn-soft" onClick={exportData}>
              ⬇ Export
            </button>
            <button type="button" className="btn btn-soft" onClick={() => fileRef.current?.click()}>
              ⬆ Import
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={onFile}
          />

          {importError && <p className="error">{importError}</p>}

          {pending && (
            <div className="notice">
              <p>
                Backup from{' '}
                {pending.exportedAt ? format(pending.exportedAt, 'MMM d, yyyy') : 'unknown date'}:{' '}
                {pending.events.length} entries, {pending.growth.length} measurements,{' '}
                {pending.appointments.length} appointments. Importing{' '}
                <strong>replaces</strong> what is on this device
                {cloud.phase === 'ready' ? ' and, through sync, on your partner’s phone too' : ''}.
              </p>
              <div className="row-2">
                <button type="button" className="btn btn-primary" onClick={applyImport}>
                  Replace my data
                </button>
                <button type="button" className="btn btn-soft" onClick={() => setPending(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <button type="button" className="btn btn-danger" onClick={clearAll}>
            {confirmClear
              ? cloud.phase === 'ready'
                ? 'Tap again to erase everything (also for your partner)'
                : 'Tap again to erase everything'
              : 'Clear all data'}
          </button>
          {confirmClear && (
            <button type="button" className="link-btn centered" onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
          )}
        </section>

      </div>
    </>
  )
}
