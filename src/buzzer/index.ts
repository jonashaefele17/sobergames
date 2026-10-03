// Single point of import for the active BuzzerStore implementation (same switch as src/store/index.ts).
import { useSyncExternalStore } from 'react'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { buzzerStore as localStore } from './LocalBuzzerStore'
import { buzzerStore as supabaseStore } from './SupabaseBuzzerStore'

export const buzzerStore = isSupabaseConfigured ? supabaseStore : localStore

export function useBuzzer() {
  return useSyncExternalStore(buzzerStore.subscribe, buzzerStore.getSnapshot)
}
