export type Scene = 'intro' | 'wheel' | 'teams' | 'games' | 'scoreboard' | 'winner' | 'play'

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

/** Ein Spiel des Abends; Name, Kategorie und Spielart stehen fest in src/games/catalog.ts. */
export interface Game {
  id: string
  revealed: boolean
  result: GameResult | null
  /** gewählte Variante, z. B. Kippmoment statt Arschbolzen */
  variant?: string
}

/** Was der Beamer von der aktuellen Quiz-Frage zeigt; Antwort erst nach der Auflösung. */
export interface QuizView {
  /** 0-basiert */
  index: number
  total: number
  text: string
  imageUrl: string | null
  answer: string | null
  info: string | null
  phase: 'question' | 'answer'
}

/** Countdown nur zur Orientierung des Hosts; läuft über 0 hinaus weiter. */
export interface Timer {
  durationMs: number
  /** Zeitpunkt (ms) des letzten Starts, null wenn pausiert */
  startedAt: number | null
  /** bis zur letzten Pause verstrichene Zeit */
  elapsedMs: number
}

/** Eine Buchung auf der Punktetafel: Punkte je Team */
export interface ScoreRound {
  id: string
  points: Record<string, number>
}

export interface ScoreData {
  rounds: ScoreRound[]
  /** Zielpunktzahl; null = ohne Ziel */
  target: number | null
  /** Modus „shots“: Punkte je Versuch und Team, null = noch offen */
  shots?: Record<string, (number | null)[]>
  shotCount?: number
}

export interface StopwatchData {
  /** gestoppte Zeit je Team in ms */
  times: Record<string, number>
  running: { teamId: string; startedAt: number } | null
}

/** Daten der laufenden Spielart; jede Spielart nutzt nur ihren Teil. */
export interface PlayData {
  score?: ScoreData
  stopwatch?: StopwatchData
  /** eingetragene Messwerte je Team, z. B. Turmhöhe */
  values?: Record<string, number>
  /** Fragenrunde: je Frage (Index) die Teams, die den Punkt bekommen */
  awards?: Record<number, string[]>
  measure?: MeasureData
}

/** Messen: je Objekt und Team zwei Werte (z. B. Gewichte der beiden Hälften) */
export interface MeasureData {
  items: { id: string; name: string }[]
  /** weights[objektId][teamId] = [erste, zweite Hälfte] */
  weights: Record<string, Record<string, [number | null, number | null]>>
}

export interface Play {
  gameId: string | null
  quiz: QuizView | null
  timer: Timer
  data: PlayData
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
  play: Play
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
