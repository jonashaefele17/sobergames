import type { Mode } from '../store/types'

export type BuzzerStatus = 'open' | 'locked'

export interface Judgement {
  /** zählt hoch, damit die Show jede Wertung genau einmal animiert */
  nonce: number
  teamId: string
  correct: boolean
}

export interface BuzzerState {
  armed: boolean
  status: BuzzerStatus
  buzzedTeamId: string | null
  /** Serverzeit des Buzz (ISO) */
  buzzedAt: string | null
  excludedTeamIds: string[]
  question: number
  roundScores: Record<string, number>
  lastJudgement: Judgement | null
}

export interface BuzzerData {
  ready: boolean
  /** true, solange ein Schreibvorgang ans Backend fehlgeschlagen ist und noch wiederholt wird */
  unsaved: boolean
  live: BuzzerState
  test: BuzzerState
  /** Team-IDs, deren Handy gerade verbunden ist */
  connected: Record<Mode, string[]>
}

export interface TokenOwner {
  mode: Mode
  teamId: string
}

export const initialBuzzer = (): BuzzerState => ({
  armed: false,
  status: 'open',
  buzzedTeamId: null,
  buzzedAt: null,
  excludedTeamIds: [],
  question: 1,
  roundScores: {},
  lastJudgement: null,
})

/**
 * Backend-agnostic buzzer API (same split as the Buzzer repo: local for dev,
 * Supabase in production). Host actions act on one mode; team phones only
 * ever call buzz() with their secret code.
 */
export interface BuzzerStore {
  subscribe(listener: () => void): () => void
  getSnapshot(): BuzzerData

  // Host
  arm(mode: Mode, on: boolean): void
  judge(mode: Mode, correct: boolean): void
  release(mode: Mode): void
  nextQuestion(mode: Mode): void
  adjustRound(mode: Mode, teamId: string, delta: number): void
  resetRound(mode: Mode): void
  /** Codes aller Teams; fehlende werden angelegt */
  ensureTokens(mode: Mode, teamIds: string[]): Promise<Record<string, string>>
  /** neuer Code für ein Team, der alte wird ungültig */
  regenerateToken(mode: Mode, teamId: string): Promise<string>

  // Team-Handy
  resolveToken(token: string): Promise<TokenOwner | null>
  buzz(token: string): Promise<boolean>
  /** meldet ein Handy als verbunden an; Rückgabe meldet es wieder ab */
  connect(owner: TokenOwner): () => void
}

/** 10 Zeichen ohne verwechselbare Zeichen (0/O, 1/l/I) */
export function newToken(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

// ---------- reine Zustandsübergänge, von beiden Stores genutzt ----------

export function applyBuzz(s: BuzzerState, teamId: string, at: string): BuzzerState | null {
  if (!s.armed || s.status !== 'open' || s.excludedTeamIds.includes(teamId)) return null
  return { ...s, status: 'locked', buzzedTeamId: teamId, buzzedAt: at }
}

const nextNonce = (s: BuzzerState) => (s.lastJudgement?.nonce ?? 0) + 1

export function applyJudge(s: BuzzerState, correct: boolean): BuzzerState | null {
  const teamId = s.buzzedTeamId
  if (s.status !== 'locked' || !teamId) return null
  const judgement = { nonce: nextNonce(s), teamId, correct }
  if (correct) {
    return {
      ...s,
      status: 'open',
      buzzedTeamId: null,
      buzzedAt: null,
      excludedTeamIds: [],
      question: s.question + 1,
      roundScores: { ...s.roundScores, [teamId]: (s.roundScores[teamId] ?? 0) + 1 },
      lastJudgement: judgement,
    }
  }
  return {
    ...s,
    status: 'open',
    buzzedTeamId: null,
    buzzedAt: null,
    excludedTeamIds: [...s.excludedTeamIds, teamId],
    lastJudgement: judgement,
  }
}
