import type { Session } from '@supabase/supabase-js'
import { createMemoryStore } from './memstore'
import { profileStore } from './stores'
import { startSync, stopSync, syncMeta } from './sync'
import { supabase } from './supabase'

export type CloudPhase =
  | 'unavailable' // built without Supabase settings
  | 'loading'
  | 'signedOut'
  | 'needsBaby' // signed in, but not yet part of a baby
  | 'ready' // signed in and syncing
  | 'error'

export const cloudStore = createMemoryStore<{
  phase: CloudPhase
  email?: string
  userId?: string
  babyId?: string
  error?: string
}>({ phase: supabase ? 'loading' : 'unavailable' })

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string }

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

function friendly(message: string | undefined): string {
  const m = message ?? ''
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password.'
  if (/already registered|already been registered/i.test(m))
    return 'That email already has an account. Try signing in.'
  if (/password should be at least|at least \d+ characters/i.test(m))
    return 'Use a password with at least 8 characters.'
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a minute and try again.'
  if (/valid email|invalid email/i.test(m)) return 'That email address does not look right.'
  if (/failed to fetch|network|load failed/i.test(m))
    return 'No connection. Check your internet and try again.'
  if (/invalid_or_expired_code/.test(m)) return 'That code is not valid, or it has expired.'
  if (/already_has_baby/.test(m)) return 'This account already has a baby.'
  return m || 'Something went wrong. Please try again.'
}

let bootstrapping: string | null = null

async function bootstrap(userId: string, email: string | undefined) {
  const sb = supabase
  if (!sb || bootstrapping === userId) return
  bootstrapping = userId
  try {
    // Returning to a device that already synced: start right away, even offline
    const meta = syncMeta.getSnapshot()
    if (meta.userId === userId && meta.babyId) {
      cloudStore.set({ phase: 'ready', email, userId, babyId: meta.babyId })
      void startSync(userId, meta.babyId, { seedProfile: false })
      return
    }

    const { data, error } = await sb
      .from('baby_members')
      .select('baby_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      cloudStore.set({ phase: 'error', email, userId, error: friendly(error.message) })
      return
    }
    if (!data) {
      cloudStore.set({ phase: 'needsBaby', email, userId })
      return
    }
    cloudStore.set({ phase: 'ready', email, userId, babyId: data.baby_id })
    void startSync(userId, data.baby_id, { seedProfile: false })
  } finally {
    bootstrapping = null
  }
}

async function handleSession(session: Session | null) {
  if (!session) {
    stopSync()
    cloudStore.set({ phase: 'signedOut' })
    return
  }
  const current = cloudStore.getSnapshot()
  // token refreshes and repeated events for the same user need no work
  if (current.userId === session.user.id && (current.phase === 'ready' || current.phase === 'needsBaby')) {
    return
  }
  cloudStore.set({ phase: 'loading', email: session.user.email, userId: session.user.id })
  await bootstrap(session.user.id, session.user.email)
}

/** Call once at startup. */
export function initCloud() {
  if (!supabase) return
  supabase.auth.onAuthStateChange((_event, session) => {
    // Do not call Supabase from inside this callback; defer to the next tick
    setTimeout(() => void handleSession(session), 0)
  })
}

export async function signUp(email: string, password: string): Promise<Result> {
  if (!supabase) return fail('Cloud sync is not available in this build.')
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
  if (error) return fail(friendly(error.message))
  if (!data.session) {
    return fail('Account created. Check your email to confirm it, then sign in.')
  }
  return { ok: true, value: undefined }
}

export async function signIn(email: string, password: string): Promise<Result> {
  if (!supabase) return fail('Cloud sync is not available in this build.')
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) return fail(friendly(error.message))
  return { ok: true, value: undefined }
}

export async function signOut() {
  await supabase?.auth.signOut()
}

/** Create this account's baby from the local profile, and upload everything on this device. */
export async function createBaby(): Promise<Result> {
  const { userId, email } = cloudStore.getSnapshot()
  if (!supabase || !userId) return fail('Please sign in first.')
  const profile = profileStore.getSnapshot()
  const { data, error } = await supabase.rpc('create_baby', {
    p_name: profile.name,
    p_birth_date: profile.birthDate || null,
  })
  if (error) return fail(friendly(error.message))
  const babyId = data as string
  cloudStore.set({ phase: 'ready', email, userId, babyId })
  void startSync(userId, babyId, { seedProfile: true })
  return { ok: true, value: undefined }
}

/** Join a partner's baby with an invite code. Entries already on this device are added too. */
export async function joinWithCode(code: string): Promise<Result> {
  const { userId, email } = cloudStore.getSnapshot()
  if (!supabase || !userId) return fail('Please sign in first.')
  const { data, error } = await supabase.rpc('accept_invite', { p_code: code.trim().toUpperCase() })
  if (error) return fail(friendly(error.message))
  const babyId = data as string
  cloudStore.set({ phase: 'ready', email, userId, babyId })
  void startSync(userId, babyId, { seedProfile: false })
  return { ok: true, value: undefined }
}

/** A single-use code (valid 24 hours) your partner enters after creating an account. */
export async function createInvite(): Promise<Result<string>> {
  const { babyId } = cloudStore.getSnapshot()
  if (!supabase || !babyId) return fail('Not connected to a baby yet.')
  const { data, error } = await supabase.rpc('create_invite', { p_baby_id: babyId })
  if (error) return fail(friendly(error.message))
  return { ok: true, value: data as string }
}

export async function countMembers(): Promise<number | null> {
  if (!supabase) return null
  const { count, error } = await supabase
    .from('baby_members')
    .select('user_id', { count: 'exact', head: true })
  return error ? null : count
}

/** Retry after a failed start (for example, no connection on launch). */
export async function retryBootstrap() {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } }
  cloudStore.set({ phase: 'loading' })
  await handleSession(data.session)
}
