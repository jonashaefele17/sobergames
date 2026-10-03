// Single point of import for the active GameStore implementation.
// Uses Supabase when VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY are set (see .env.example),
// otherwise falls back to the local-only store for dev/testing without a Supabase project.
import { useSyncExternalStore } from 'react'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { gameStore as localStore } from './LocalStore'
import { gameStore as supabaseStore } from './SupabaseStore'

export const gameStore = isSupabaseConfigured ? supabaseStore : localStore

export function useGame() {
  return useSyncExternalStore(gameStore.subscribe, gameStore.getSnapshot)
}
