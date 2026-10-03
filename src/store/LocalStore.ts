import { normalize } from '../lib/actions'
import type { GameStore, Snapshot, State } from './types'

const STORAGE_KEY = 'sobergames-local-v2'
const LEGACY_KEY = 'sobergames-local-v1'
const CHANNEL_NAME = 'sobergames-sync-v2'

/**
 * Local implementation of GameStore for development and as an offline fallback.
 * Persists to localStorage and syncs across tabs via BroadcastChannel + storage events,
 * so projector and host can be two windows on the same laptop.
 */
class LocalStore implements GameStore {
  private state: State
  private snapshot: Snapshot
  private listeners = new Set<() => void>()
  private channel: BroadcastChannel | null = null

  constructor() {
    this.state = this.load()
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

  private load(): State {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return normalize(JSON.parse(raw) as Partial<State>)
      // früheres Format mit Live- und Teststand: den Live-Stand übernehmen
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (legacy) return normalize((JSON.parse(legacy) as { live?: Partial<State> }).live)
    } catch {
      // fall through to a fresh state
    }
    return normalize(null)
  }

  private toSnapshot(): Snapshot {
    return { ready: true, unsaved: false, state: this.state }
  }

  private reload() {
    this.state = this.load()
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
    this.state = fn(this.state)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    this.channel?.postMessage('update')
    this.notify()
  }
}

export const gameStore = new LocalStore()
