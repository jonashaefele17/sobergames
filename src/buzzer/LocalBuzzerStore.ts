import type { Mode } from '../store/types'
import {
  applyBuzz,
  applyJudge,
  initialBuzzer,
  newToken,
  type BuzzerData,
  type BuzzerState,
  type BuzzerStore,
  type TokenOwner,
} from './types'

const STATE_KEY = 'sobergames-buzzer-v1'
const TOKEN_KEY = 'sobergames-buzzer-tokens-v1'
const CHANNEL_NAME = 'sobergames-buzzer-sync-v1'
const PRESENCE_CHANNEL = 'sobergames-buzzer-presence-v1'
const PRESENCE_TIMEOUT_MS = 5000

type Rows = Record<Mode, BuzzerState>
type Tokens = Record<string, TokenOwner>

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/**
 * Local implementation of BuzzerStore for development, tests and as offline
 * fallback. Each tab re-reads localStorage before every change, so several
 * tabs (projector, host, team phones) behave like separate devices.
 */
class LocalBuzzerStore implements BuzzerStore {
  private data: BuzzerData
  private listeners = new Set<() => void>()
  private channel: BroadcastChannel | null = null
  private presence: BroadcastChannel | null = null
  private lastSeen = new Map<string, number>()

  constructor() {
    const rows = this.loadRows()
    this.data = { ready: true, unsaved: false, ...rows, connected: { live: [], test: [] } }

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL_NAME)
      this.channel.onmessage = () => this.reload()
      this.presence = new BroadcastChannel(PRESENCE_CHANNEL)
      this.presence.onmessage = (e: MessageEvent<TokenOwner & { leave?: boolean }>) => {
        const key = `${e.data.mode}:${e.data.teamId}`
        if (e.data.leave) this.lastSeen.delete(key)
        else this.lastSeen.set(key, Date.now())
        this.updatePresence()
      }
      window.setInterval(() => this.updatePresence(), 2000)
    }
    window.addEventListener('storage', (e) => {
      if (e.key === STATE_KEY) this.reload()
    })
  }

  private loadRows(): Rows {
    const rows = read<Partial<Rows>>(STATE_KEY, {})
    return { live: { ...initialBuzzer(), ...rows.live }, test: { ...initialBuzzer(), ...rows.test } }
  }

  private reload() {
    this.data = { ...this.data, ...this.loadRows() }
    this.notify()
  }

  private updatePresence() {
    const now = Date.now()
    const connected: Record<Mode, string[]> = { live: [], test: [] }
    for (const [key, t] of this.lastSeen) {
      if (now - t > PRESENCE_TIMEOUT_MS) continue
      const [mode, teamId] = key.split(':') as [Mode, string]
      connected[mode].push(teamId)
    }
    const same = (m: Mode) => connected[m].slice().sort().join() === this.data.connected[m].slice().sort().join()
    if (same('live') && same('test')) return
    this.data = { ...this.data, connected }
    this.notify()
  }

  private notify() {
    for (const listener of this.listeners) listener()
  }

  /** frisch lesen, ändern, speichern – damit kein Tab einen veralteten Stand zurückschreibt */
  private mutate(mode: Mode, fn: (s: BuzzerState) => BuzzerState | null): boolean {
    const rows = this.loadRows()
    const next = fn(rows[mode])
    if (!next) return false
    const updated = { ...rows, [mode]: next }
    localStorage.setItem(STATE_KEY, JSON.stringify(updated))
    this.data = { ...this.data, ...updated }
    this.channel?.postMessage('update')
    this.notify()
    return true
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.data

  arm(mode: Mode, on: boolean) {
    this.mutate(mode, (s) => (on ? { ...s, armed: true } : { ...s, armed: false, status: 'open', buzzedTeamId: null, buzzedAt: null }))
  }

  judge(mode: Mode, correct: boolean) {
    this.mutate(mode, (s) => applyJudge(s, correct))
  }

  release(mode: Mode) {
    this.mutate(mode, (s) => ({ ...s, status: 'open', buzzedTeamId: null, buzzedAt: null }))
  }

  nextQuestion(mode: Mode) {
    this.mutate(mode, (s) => ({ ...s, status: 'open', buzzedTeamId: null, buzzedAt: null, excludedTeamIds: [], question: s.question + 1 }))
  }

  adjustRound(mode: Mode, teamId: string, delta: number) {
    this.mutate(mode, (s) => ({ ...s, roundScores: { ...s.roundScores, [teamId]: (s.roundScores[teamId] ?? 0) + delta } }))
  }

  resetRound(mode: Mode) {
    this.mutate(mode, (s) => ({ ...initialBuzzer(), armed: s.armed, lastJudgement: s.lastJudgement }))
  }

  async ensureTokens(mode: Mode, teamIds: string[]) {
    const tokens = read<Tokens>(TOKEN_KEY, {})
    const out: Record<string, string> = {}
    for (const [token, owner] of Object.entries(tokens)) {
      if (owner.mode === mode) out[owner.teamId] = token
    }
    for (const teamId of teamIds) {
      if (out[teamId]) continue
      out[teamId] = newToken()
      tokens[out[teamId]] = { mode, teamId }
    }
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
    return out
  }

  async regenerateToken(mode: Mode, teamId: string) {
    const tokens = read<Tokens>(TOKEN_KEY, {})
    for (const [token, owner] of Object.entries(tokens)) {
      if (owner.mode === mode && owner.teamId === teamId) delete tokens[token]
    }
    const token = newToken()
    tokens[token] = { mode, teamId }
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
    return token
  }

  async resolveToken(token: string) {
    return read<Tokens>(TOKEN_KEY, {})[token] ?? null
  }

  async buzz(token: string) {
    const owner = await this.resolveToken(token)
    if (!owner) return false
    return this.mutate(owner.mode, (s) => applyBuzz(s, owner.teamId, new Date().toISOString()))
  }

  connect(owner: TokenOwner) {
    const ping = () => this.presence?.postMessage(owner)
    ping()
    const id = window.setInterval(ping, 2000)
    return () => {
      window.clearInterval(id)
      this.presence?.postMessage({ ...owner, leave: true })
    }
  }
}

export const buzzerStore = new LocalBuzzerStore()
