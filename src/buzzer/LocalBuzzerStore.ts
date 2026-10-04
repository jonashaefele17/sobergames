import { applyBuzz, applyJudge, applySetExcluded, applyStartQuestion, applyUndo, initialBuzzer, newToken, type BuzzerData, type BuzzerState, type BuzzerStore } from './types'

const STATE_KEY = 'sobergames-buzzer-v2'
const TOKEN_KEY = 'sobergames-buzzer-tokens-v2'
const CHANNEL_NAME = 'sobergames-buzzer-sync-v2'
const PRESENCE_CHANNEL = 'sobergames-buzzer-presence-v2'
const PRESENCE_TIMEOUT_MS = 5000

/** Code → Team-ID */
type Tokens = Record<string, string>

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
    this.data = { ready: true, unsaved: false, state: this.loadState(), connected: [] }

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL_NAME)
      this.channel.onmessage = () => this.reload()
      this.presence = new BroadcastChannel(PRESENCE_CHANNEL)
      this.presence.onmessage = (e: MessageEvent<{ teamId: string; leave?: boolean }>) => {
        if (e.data.leave) this.lastSeen.delete(e.data.teamId)
        else this.lastSeen.set(e.data.teamId, Date.now())
        this.updatePresence()
      }
      window.setInterval(() => this.updatePresence(), 2000)
    }
    window.addEventListener('storage', (e) => {
      if (e.key === STATE_KEY) this.reload()
    })
  }

  private loadState(): BuzzerState {
    return { ...initialBuzzer(), ...read<Partial<BuzzerState>>(STATE_KEY, {}) }
  }

  private reload() {
    this.data = { ...this.data, state: this.loadState() }
    this.notify()
  }

  private updatePresence() {
    const now = Date.now()
    const connected = [...this.lastSeen].filter(([, t]) => now - t <= PRESENCE_TIMEOUT_MS).map(([id]) => id)
    if (connected.slice().sort().join() === this.data.connected.slice().sort().join()) return
    this.data = { ...this.data, connected }
    this.notify()
  }

  private notify() {
    for (const listener of this.listeners) listener()
  }

  /** frisch lesen, ändern, speichern – damit kein Tab einen veralteten Stand zurückschreibt */
  private mutate(fn: (s: BuzzerState) => BuzzerState | null): boolean {
    const next = fn(this.loadState())
    if (!next) return false
    localStorage.setItem(STATE_KEY, JSON.stringify(next))
    this.data = { ...this.data, state: next }
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

  arm(on: boolean) {
    this.mutate((s) => (on ? { ...s, armed: true } : { ...s, armed: false, status: 'open', buzzedTeamId: null, buzzedAt: null }))
  }

  judge(correct: boolean, opts: { pause?: boolean } = {}) {
    this.mutate((s) => applyJudge(s, correct, opts.pause))
  }

  startQuestion() {
    this.mutate(applyStartQuestion)
  }

  undoJudge() {
    this.mutate((s) => applyUndo(s, new Date().toISOString()))
  }

  setExcluded(teamId: string, excluded: boolean) {
    this.mutate((s) => applySetExcluded(s, teamId, excluded))
  }

  release() {
    this.mutate((s) => ({ ...s, status: 'open', buzzedTeamId: null, buzzedAt: null }))
  }

  nextQuestion() {
    this.mutate((s) => ({ ...s, status: 'open', buzzedTeamId: null, buzzedAt: null, excludedTeamIds: [], question: s.question + 1 }))
  }

  adjustRound(teamId: string, delta: number) {
    this.mutate((s) => ({ ...s, roundScores: { ...s.roundScores, [teamId]: (s.roundScores[teamId] ?? 0) + delta } }))
  }

  resetRound() {
    this.mutate((s) => ({ ...initialBuzzer(), armed: s.armed, lastJudgement: s.lastJudgement }))
  }

  async ensureTokens(teamIds: string[]) {
    const tokens = read<Tokens>(TOKEN_KEY, {})
    const out: Record<string, string> = {}
    for (const [token, teamId] of Object.entries(tokens)) out[teamId] = token
    for (const teamId of teamIds) {
      if (out[teamId]) continue
      out[teamId] = newToken()
      tokens[out[teamId]] = teamId
    }
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
    return out
  }

  async regenerateToken(teamId: string) {
    const tokens = Object.fromEntries(Object.entries(read<Tokens>(TOKEN_KEY, {})).filter(([, id]) => id !== teamId))
    const token = newToken()
    tokens[token] = teamId
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
    return token
  }

  async resolveToken(token: string) {
    return read<Tokens>(TOKEN_KEY, {})[token] ?? null
  }

  async buzz(token: string) {
    const teamId = await this.resolveToken(token)
    if (!teamId) return false
    return this.mutate((s) => applyBuzz(s, teamId, new Date().toISOString()))
  }

  connect(teamId: string) {
    const ping = () => this.presence?.postMessage({ teamId })
    ping()
    const id = window.setInterval(ping, 2000)
    return () => {
      window.clearInterval(id)
      this.presence?.postMessage({ teamId, leave: true })
    }
  }
}

export const buzzerStore = new LocalBuzzerStore()
