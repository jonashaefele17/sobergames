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
  state: BuzzerState
  /** Team-IDs, deren Handy gerade verbunden ist */
  connected: string[]
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
 * Supabase in production). Team phones only ever call buzz() with their
 * secret code; everything else is a host action.
 */
export interface BuzzerStore {
  subscribe(listener: () => void): () => void
  getSnapshot(): BuzzerData

  // Host
  arm(on: boolean): void
  /** Richtig/Falsch; mit pause bleibt der Buzzer nach „Richtig“ aus (z. B. während die Antwort gezeigt wird) */
  judge(correct: boolean, opts?: { pause?: boolean }): void
  /** neue Frage: Buzzer scharf, frei für alle, Sperren aufgehoben */
  startQuestion(): void
  release(): void
  nextQuestion(): void
  adjustRound(teamId: string, delta: number): void
  resetRound(): void
  /** Codes aller Teams; fehlende werden angelegt */
  ensureTokens(teamIds: string[]): Promise<Record<string, string>>
  /** neuer Code für ein Team, der alte wird ungültig */
  regenerateToken(teamId: string): Promise<string>

  // Team-Handy
  /** Team-ID zu einem Code, null wenn ungültig */
  resolveToken(token: string): Promise<string | null>
  buzz(token: string): Promise<boolean>
  /** meldet ein Handy als verbunden an; Rückgabe meldet es wieder ab */
  connect(teamId: string): () => void
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

export function applyJudge(s: BuzzerState, correct: boolean, pause = false): BuzzerState | null {
  const teamId = s.buzzedTeamId
  if (s.status !== 'locked' || !teamId) return null
  const judgement = { nonce: nextNonce(s), teamId, correct }
  if (correct) {
    return {
      ...s,
      armed: pause ? false : s.armed,
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

export const applyStartQuestion = (s: BuzzerState): BuzzerState => ({
  ...s,
  armed: true,
  status: 'open',
  buzzedTeamId: null,
  buzzedAt: null,
  excludedTeamIds: [],
})
