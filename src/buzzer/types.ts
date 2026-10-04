export type BuzzerStatus = 'open' | 'locked'

export interface Judgement {
  /** zählt hoch, damit die Show jede Wertung genau einmal animiert */
  nonce: number
  teamId: string
  correct: boolean
  /** Sperren vor der Wertung, damit sie sich rückgängig machen lässt */
  excludedBefore?: string[]
  /** schon rückgängig gemacht */
  undone?: boolean
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
  /** letzte Wertung zurücknehmen: das Team ist wieder dran, Punkt bzw. Sperre fällt weg */
  undoJudge(): void
  /** ein einzelnes Team für die laufende Frage sperren oder wieder freigeben */
  setExcluded(teamId: string, excluded: boolean): void
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
  const judgement: Judgement = { nonce: nextNonce(s), teamId, correct, excludedBefore: s.excludedTeamIds }
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

/** Kann die letzte Wertung noch zurückgenommen werden? Nicht mehr, sobald jemand neu gebuzzert hat. */
export const canUndo = (s: BuzzerState) => Boolean(s.lastJudgement && !s.lastJudgement.undone && s.status === 'open')

export function applyUndo(s: BuzzerState, at: string): BuzzerState | null {
  const j = s.lastJudgement
  if (!j || !canUndo(s)) return null
  const restored: BuzzerState = {
    ...s,
    armed: true,
    status: 'locked',
    buzzedTeamId: j.teamId,
    buzzedAt: at,
    excludedTeamIds: j.excludedBefore ?? s.excludedTeamIds.filter((id) => id !== j.teamId),
    lastJudgement: { ...j, undone: true },
  }
  if (!j.correct) return restored
  return {
    ...restored,
    question: Math.max(1, s.question - 1),
    roundScores: { ...s.roundScores, [j.teamId]: Math.max(0, (s.roundScores[j.teamId] ?? 0) - 1) },
  }
}

export function applySetExcluded(s: BuzzerState, teamId: string, excluded: boolean): BuzzerState {
  const without = s.excludedTeamIds.filter((id) => id !== teamId)
  return { ...s, excludedTeamIds: excluded ? [...without, teamId] : without }
}
