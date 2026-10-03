import { initialState, normalize } from '../lib/actions'
import { supabase } from '../lib/supabaseClient'
import type { GameStore, Mode, Snapshot, State } from './types'

const ROW_ID = 1
const TABLE = 'sobergames'
const BACKUP_KEY = 'sobergames-backup-v1'

interface Row {
  active: Mode
  live: State | null
  test: State | null
  updated_at: string
}

interface Data {
  active: Mode
  live: State
  test: State
}

const fill = (s: State | null | undefined): State => normalize(s)

/**
 * Supabase-backed implementation of GameStore (see supabase/schema.sql).
 *
 * Changes are applied locally first and then written as a whole column, last
 * write wins. Writes are coalesced so fast typing in the host never has more
 * than one request in flight, and the realtime echo of our own writes is
 * ignored so it can't roll the UI back to an older keystroke.
 */
class SupabaseStore implements GameStore {
  private data: Data
  private ready = false
  private snapshot: Snapshot
  private listeners = new Set<() => void>()
  private ownStamps = new Set<number>()
  private dirty = new Set<'active' | Mode>()
  private inflight = false
  private unsaved = false
  private retryTimer = 0

  constructor() {
    this.data = this.loadBackup() ?? { active: 'live', live: initialState(), test: initialState() }
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
      if (this.dirty.size > 0) void this.flush()
      else void this.loadInitial()
    })
  }

  private loadBackup(): Data | null {
    try {
      const raw = localStorage.getItem(BACKUP_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<Data>
      return { active: parsed.active ?? 'live', live: fill(parsed.live), test: fill(parsed.test) }
    } catch {
      return null
    }
  }

  private async loadInitial() {
    const { data, error } = await supabase!.from(TABLE).select('*').eq('id', ROW_ID).single()
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
    if (this.dirty.size > 0 || this.inflight) return
    this.data = { active: row.active, live: fill(row.live), test: fill(row.test) }
    this.notify()
  }

  private toSnapshot(): Snapshot {
    return { ready: this.ready, unsaved: this.unsaved, active: this.data.active, state: this.data[this.data.active], byMode: { live: this.data.live, test: this.data.test } }
  }

  private notify() {
    this.snapshot = this.toSnapshot()
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(this.data))
    } catch {
      // backup is best effort
    }
    for (const listener of this.listeners) listener()
  }

  private async flush() {
    if (this.inflight || !supabase) return
    this.inflight = true
    while (this.dirty.size > 0) {
      const stamp = new Date()
      const patch: Record<string, unknown> = { updated_at: stamp.toISOString() }
      const keys = [...this.dirty]
      for (const key of keys) patch[key] = this.data[key]
      this.dirty.clear()
      this.ownStamps.add(stamp.getTime())
      const { error } = await supabase.from(TABLE).update(patch).eq('id', ROW_ID)
      if (error) {
        // kein Netz o. Ä.: Stand bleibt lokal, wird gemerkt und gleich nochmal geschickt
        console.error('Supabase update failed', error)
        for (const key of keys) this.dirty.add(key)
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
    const mode = this.data.active
    this.data = { ...this.data, [mode]: fn(this.data[mode]) }
    this.dirty.add(mode)
    this.notify()
    void this.flush()
  }

  setActive(mode: Mode) {
    this.data = { ...this.data, active: mode }
    this.dirty.add('active')
    this.notify()
    void this.flush()
  }
}

export const gameStore = new SupabaseStore()
