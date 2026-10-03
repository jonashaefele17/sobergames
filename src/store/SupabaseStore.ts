import { normalize } from '../lib/actions'
import { supabase } from '../lib/supabaseClient'
import type { GameStore, Snapshot, State } from './types'

const ROW_ID = 1
const TABLE = 'sobergames'
const BACKUP_KEY = 'sobergames-backup-v2'

interface Row {
  state: State | null
  updated_at: string
}

/**
 * Supabase-backed implementation of GameStore (see supabase/schema.sql).
 *
 * Changes are applied locally first and then written as a whole, last write
 * wins. Writes are coalesced so fast typing in the host never has more than one
 * request in flight, and the realtime echo of our own writes is ignored so it
 * can't roll the UI back to an older keystroke.
 */
class SupabaseStore implements GameStore {
  private state: State
  private ready = false
  private snapshot: Snapshot
  private listeners = new Set<() => void>()
  private ownStamps = new Set<number>()
  private dirty = false
  private inflight = false
  private unsaved = false
  private retryTimer = 0

  constructor() {
    this.state = this.loadBackup() ?? normalize(null)
    this.snapshot = this.toSnapshot()
    if (!supabase) return
    void this.loadInitial()

    supabase
      .channel('sobergames-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: TABLE, filter: `id=eq.${ROW_ID}` },
        (payload) => this.applyRow(payload.new as Row),
      )
      .subscribe()

    // Mobile OSes suspend websockets while a tab is backgrounded/locked, so a
    // realtime update can be missed; force a fresh fetch whenever the device
    // wakes back up or regains network, instead of trusting only the next event.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.loadInitial()
    })
    window.addEventListener('online', () => {
      if (this.dirty) void this.flush()
      else void this.loadInitial()
    })
  }

  private loadBackup(): State | null {
    try {
      const raw = localStorage.getItem(BACKUP_KEY)
      return raw ? normalize(JSON.parse(raw) as Partial<State>) : null
    } catch {
      return null
    }
  }

  private async loadInitial() {
    const { data, error } = await supabase!.from(TABLE).select('state, updated_at').eq('id', ROW_ID).single()
    if (error || !data) {
      console.error('Failed to load state from Supabase', error)
      // keep showing the local backup so the evening can go on
      this.ready = true
      this.notify()
      return
    }
    this.ready = true
    this.applyRow(data as Row)
  }

  private applyRow(row: Row) {
    if (this.ownStamps.has(Date.parse(row.updated_at))) return
    if (this.dirty || this.inflight) return
    this.state = normalize(row.state)
    this.notify()
  }

  private toSnapshot(): Snapshot {
    return { ready: this.ready, unsaved: this.unsaved, state: this.state }
  }

  private notify() {
    this.snapshot = this.toSnapshot()
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(this.state))
    } catch {
      // backup is best effort
    }
    for (const listener of this.listeners) listener()
  }

  private async flush() {
    if (this.inflight || !supabase) return
    this.inflight = true
    while (this.dirty) {
      const stamp = new Date()
      this.dirty = false
      this.ownStamps.add(stamp.getTime())
      const { error } = await supabase
        .from(TABLE)
        .update({ state: this.state, updated_at: stamp.toISOString() })
        .eq('id', ROW_ID)
      if (error) {
        // kein Netz o. Ä.: Stand bleibt lokal, wird gemerkt und gleich nochmal geschickt
        console.error('Supabase update failed', error)
        this.dirty = true
        this.setUnsaved(true)
        window.clearTimeout(this.retryTimer)
        this.retryTimer = window.setTimeout(() => void this.flush(), 5000)
        break
      }
      this.setUnsaved(false)
    }
    this.inflight = false
  }

  private setUnsaved(unsaved: boolean) {
    if (this.unsaved === unsaved) return
    this.unsaved = unsaved
    this.notify()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.snapshot

  update(fn: (state: State) => State) {
    this.state = fn(this.state)
    this.dirty = true
    this.notify()
    void this.flush()
  }
}

export const gameStore = new SupabaseStore()
