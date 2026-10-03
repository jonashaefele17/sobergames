export type Scene = 'intro' | 'wheel' | 'teams' | 'games' | 'scoreboard' | 'winner'

export interface Player {
  id: string
  name: string
}

export interface Team {
  id: string
  name: string
  color: string
  playerIds: string[]
}

export interface GameResult {
  /** places[0] = Team-IDs auf Platz 1, places[1] = Platz 2 … (geteilte Plätze möglich) */
  places: string[][]
}

export interface Game {
  id: string
  name: string
  category: string
  revealed: boolean
  link?: string
  result: GameResult | null
}

export interface Scoring {
  /** Punkte für Platz 1, 2, 3 …; weitere Plätze bekommen 0 */
  placePoints: number[]
  /** Faktor für das letzte Spiel (Finale); hängt am Platz, nicht am Spiel */
  finaleFactor: number
}

export interface Adjustment {
  id: string
  teamId: string
  delta: number
  note: string
}

export interface State {
  scene: Scene
  players: Player[]
  teams: Team[]
  /** spinId zählt hoch; die Show animiert nur, wenn sie eine Änderung live miterlebt. */
  wheel: { spinId: number; targetPlayerId: string | null }
  scoring: Scoring
  games: Game[]
  adjustments: Adjustment[]
  spotlight: { nonce: number; gameId: string | null }
  introNonce: number
  showTicker: boolean
  showRaceHints: boolean
}

export interface Snapshot {
  ready: boolean
  /** true, solange ein Schreibvorgang ans Backend fehlgeschlagen ist und noch wiederholt wird */
  unsaved: boolean
  state: State
}

export interface GameStore {
  subscribe(listener: () => void): () => void
  getSnapshot(): Snapshot
  update(fn: (state: State) => State): void
}
