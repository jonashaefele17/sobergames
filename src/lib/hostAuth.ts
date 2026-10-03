import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './supabaseClient'

// Supabase Auth requires an email; the host only ever types a username, so we
// translate it to a fixed synthetic address under the hood (login „host“ → host@sobergames.local).
const EMAIL_DOMAIN = 'sobergames.local'

function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`
}

export async function signInHost(username: string, password: string): Promise<string | null> {
  if (!supabase) return 'Supabase ist nicht konfiguriert.'
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  })
  return error ? 'Benutzername oder Passwort ist falsch.' : null
}

export async function signOutHost(): Promise<void> {
  await supabase?.auth.signOut()
}

/**
 * Tracks the host's Supabase Auth session. Returns 'local' when Supabase isn't
 * configured at all (local store), so the host view stays open without login.
 */
export function useHostSession(): Session | null | 'loading' | 'local' {
  const [session, setSession] = useState<Session | null | 'loading'>('loading')

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) return 'local'
  return session
}
