import { cloudStore } from '../lib/cloud'
import { useStore } from '../lib/hooks'
import { pendingCount } from '../lib/outbox'
import { syncMeta, syncStatus } from '../lib/sync'

/** Small cloud status badge. Hidden unless the account is signed in and syncing. */
export default function SyncPill() {
  const cloud = useStore(cloudStore)
  const meta = useStore(syncMeta)
  const status = useStore(syncStatus)

  if (cloud.phase !== 'ready') return null

  const pending = pendingCount(meta.outbox)
  let label = 'Synced'
  let tone = 'ok'
  if (status.state === 'offline') {
    label = pending > 0 ? `Offline · ${pending} waiting` : 'Offline'
    tone = 'warn'
  } else if (status.state === 'error') {
    label = 'Sync issue'
    tone = 'bad'
  } else if (status.state === 'syncing' || pending > 0) {
    label = pending > 0 ? `Syncing ${pending}` : 'Syncing'
    tone = 'busy'
  }

  return (
    <span className={`sync-pill ${tone}`} title={status.error} role="status">
      ☁ {label}
    </span>
  )
}
