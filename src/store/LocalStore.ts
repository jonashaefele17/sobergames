import { initialState, normalize } from '../lib/actions'
import type { GameStore, Mode, Snapshot, State } from './types'

const STORAGE_KEY = 'sobergames-local-v1'
const CHANNEL_NAME = 'sobergames-sync-v1'

interface Stored {
  active: Mode
  live: State
  test: State
}

/**
 * Local implementation of GameStore for development and as an offline fallback.
 * Persists to localStorage and syncs across tabs via BroadcastChannel + storage events,
 * so projector and host can be two windows on the same laptop.
 */
class LocalStore implements GameStore {
  private data: Stored
  private snapshot: Snapshot
  private listeners = new Set<() => void>()
  private channel: BroadcastChannel | null = null

  constructor() {
    this.data = this.load()
    this.snapshot = this.toSnapshot()

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL_NAME)
      this.channel.onmessage = () => this.reload()
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) this.reload()
      })
    }
  }

  private load(): Stored {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Stored>
        return {
          active: parsed.active ?? 'live',
          live: normalize(parsed.live),
          test: normalize(parsed.test),
        }
      }
    } catch {
      // fall through to a fresh state
    }
    return { active: 'live', live: initialState(), test: initialState() }
  }

  private toSnapshot(): Snapshot {
    return { ready: true, unsaved: false, active: this.data.active, state: this.data[this.data.active], byMode: { live: this.data.live, test: this.data.test } }
  }

  private reload() {
    this.data = this.load()
    this.notify()
  }

  private save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data))
    this.channel?.postMessage('update')
    this.notify()
  }

  private notify() {
    this.snapshot = this.toSnapshot()
    for (const listener of this.listeners) listener()
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
    this.save()
  }

  setActive(mode: Mode) {
    this.data = { ...this.data, active: mode }
    this.save()
  }
}

export const gameStore = new LocalStore()
