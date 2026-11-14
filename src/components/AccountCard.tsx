import { useEffect, useState, type FormEvent } from 'react'
import {
  cloudStore,
  countMembers,
  createBaby,
  createInvite,
  joinWithCode,
  retryBootstrap,
  signIn,
  signOut,
  signUp,
  type Result,
} from '../lib/cloud'
import { useStore } from '../lib/hooks'
import { pendingCount } from '../lib/outbox'
import { profileStore } from '../lib/stores'
import { syncMeta, syncStatus } from '../lib/sync'
import { formatTime } from '../lib/format'

function SignInForm() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const result = mode === 'in' ? await signIn(email, password) : await signUp(email, password)
    setBusy(false)
    if (!result.ok) setError(result.error)
  }

  return (
    <form className="form" onSubmit={submit}>
      <p className="muted small">
        Sign in to back up your data and share it with your partner. The app also works
        without an account.
      </p>
      <label className="field">
        <span className="field-label">Email</span>
        <input
          className="input"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">Password{mode === 'up' ? ' (8+ characters)' : ''}</span>
        <input
          className="input"
          type="password"
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          required
          minLength={mode === 'up' ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
      </button>
      <button
        type="button"
        className="link-btn centered"
        onClick={() => {
          setMode(mode === 'in' ? 'up' : 'in')
          setError('')
        }}
      >
        {mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
      </button>
    </form>
  )
}

function NeedsBaby() {
  const profile = useStore(profileStore)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (action: () => Promise<Result>) => {
    setBusy(true)
    setError('')
    const result = await action()
    setBusy(false)
    if (!result.ok) setError(result.error)
  }

  return (
    <div className="form">
      <p className="muted small">
        Almost there. Are you the first parent to set this up, or joining your partner?
      </p>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => run(createBaby)}
      >
        Start {profile.name ? `${profile.name}’s` : 'a new'} shared log
      </button>
      <p className="muted small centered">Everything already on this phone is uploaded.</p>

      <div className="divider">or</div>

      <label className="field">
        <span className="field-label">Code from your partner</span>
        <input
          className="input code-input"
          type="text"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={6}
          placeholder="ABC123"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
      </label>
      <button
        type="button"
        className="btn btn-soft"
        disabled={busy || code.trim().length < 6}
        onClick={() => run(() => joinWithCode(code))}
      >
        Join with code
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}

function Ready({ email }: { email?: string }) {
  const meta = useStore(syncMeta)
  const status = useStore(syncStatus)
  const [members, setMembers] = useState<number | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmOut, setConfirmOut] = useState(false)

  useEffect(() => {
    let alive = true
    void countMembers().then((n) => alive && setMembers(n))
    return () => {
      alive = false
    }
  }, [])

  const pending = pendingCount(meta.outbox)

  const invite = async () => {
    setBusy(true)
    setError('')
    const result = await createInvite()
    setBusy(false)
    if (result.ok) setCode(result.value)
    else setError(result.error)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      // clipboard needs https; the code is shown on screen anyway
    }
  }

  return (
    <div className="form">
      <div className="account-row">
        <span className="muted small">Signed in as</span>
        <strong>{email}</strong>
      </div>
      <p className="muted small">
        {status.state === 'offline'
          ? `Offline. ${pending} change${pending === 1 ? '' : 's'} will upload when you are back online.`
          : status.state === 'error'
            ? `Sync problem: ${status.error ?? 'unknown error'}`
            : pending > 0
              ? `Uploading ${pending} change${pending === 1 ? '' : 's'}…`
              : status.lastSyncedAt
                ? `All changes saved to the cloud · ${formatTime(status.lastSyncedAt)}`
                : 'Connecting…'}
        {members !== null && ` · ${members} parent${members === 1 ? '' : 's'} on this log`}
      </p>

      {code ? (
        <div className="code-box">
          <span className="muted small">Your partner enters this after creating an account</span>
          <span className="code-value">{code}</span>
          <span className="muted small">Works once, expires in 24 hours</span>
          <button type="button" className="link-btn centered" onClick={copy}>
            Copy code
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-soft" disabled={busy} onClick={invite}>
          👪 Invite partner
        </button>
      )}
      {error && <p className="error">{error}</p>}

      <button
        type="button"
        className="btn btn-danger"
        onClick={() => (confirmOut ? signOut() : setConfirmOut(true))}
      >
        {confirmOut ? 'Tap again to sign out' : 'Sign out'}
      </button>
      {confirmOut && (
        <p className="muted small centered">
          Your data stays on this phone but stops syncing until you sign in again.
        </p>
      )}
    </div>
  )
}

export default function AccountCard() {
  const cloud = useStore(cloudStore)

  return (
    <section className="card">
      <h2>Account &amp; sync ☁️</h2>
      {cloud.phase === 'unavailable' && (
        <p className="muted">Cloud sync is not set up in this build, so data stays on this device.</p>
      )}
      {cloud.phase === 'loading' && <p className="muted">Checking your account…</p>}
      {cloud.phase === 'signedOut' && <SignInForm />}
      {cloud.phase === 'needsBaby' && <NeedsBaby />}
      {cloud.phase === 'ready' && <Ready email={cloud.email} />}
      {cloud.phase === 'error' && (
        <div className="form">
          <p className="error">{cloud.error}</p>
          <button type="button" className="btn btn-soft" onClick={() => void retryBootstrap()}>
            Try again
          </button>
        </div>
      )}
    </section>
  )
}
