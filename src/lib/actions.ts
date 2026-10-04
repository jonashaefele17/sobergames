import { GAMES, isKnownGame } from '../games/catalog'
import type { Game, GameResult, Play, Player, QuizView, Scene, State, Team } from '../store/types'

export const TEAM_COLORS = ['#ef5350', '#42a5f5', '#34c98a', '#ab7dff', '#ff9140', '#f062a6']

const uid = () => Math.random().toString(36).slice(2, 10)

function makeTeams(count: number, previous: Team[] = [], newId: (i: number) => string = uid): Team[] {
  return Array.from({ length: count }, (_, i) => ({
    id: previous[i]?.id ?? newId(i),
    name: previous[i]?.name ?? `Team ${i + 1}`,
    color: previous[i]?.color ?? TEAM_COLORS[i % TEAM_COLORS.length],
    playerIds: [],
  }))
}

const freshGame = (id: string): Game => ({ id, revealed: false, result: null })

const DEFAULT_TIMER_MS = 25 * 60 * 1000

const freshPlay = (durationMs = DEFAULT_TIMER_MS): Play => ({
  gameId: null,
  quiz: null,
  timer: { durationMs, startedAt: null, elapsedMs: 0 },
})

export function initialState(): State {
  return {
    scene: 'intro',
    players: [],
    // feste IDs im Ausgangsstand: Solange noch nichts gespeichert ist, müssen alle Geräte dieselben Teams sehen
    teams: makeTeams(3, [], (i) => `team-${i + 1}`),
    wheel: { spinId: 0, targetPlayerId: null },
    scoring: { placePoints: [3, 2, 1], finaleFactor: 3 },
    games: GAMES.map((d) => freshGame(d.id)),
    adjustments: [],
    spotlight: { nonce: 0, gameId: null },
    introNonce: 0,
    showTicker: true,
    showRaceHints: true,
    play: freshPlay(),
  }
}

type LegacyResult = { places?: string[][]; first?: string[]; second?: string[] } | null

/** Macht aus einem gespeicherten (evtl. älteren) Stand einen vollständigen State. */
export function normalize(raw: Partial<State> | null | undefined): State {
  const base = initialState()
  if (!raw) return base
  const scoring = Array.isArray(raw.scoring?.placePoints) ? raw.scoring : base.scoring
  // feste Spiele: gespeicherte Reihenfolge behalten, Unbekanntes verwerfen, Fehlendes hinten ergänzen
  const stored = (raw.games ?? []).filter((g) => isKnownGame(g.id))
  const missing = GAMES.filter((d) => !stored.some((g) => g.id === d.id)).map((d) => freshGame(d.id))
  const games = [
    ...stored.map((g): Game => {
      const r = g.result as LegacyResult
      return {
        id: g.id,
        revealed: Boolean(g.revealed),
        result: r ? { places: r.places ?? [r.first ?? [], r.second ?? []] } : null,
        ...(g.variant ? { variant: g.variant } : {}),
      }
    }),
    ...missing,
  ]
  const play = { ...base.play, ...raw.play, timer: { ...base.play.timer, ...raw.play?.timer } }
  return { ...base, ...raw, scoring, games, play }
}

// ---------- Szene ----------

export const setScene = (scene: Scene) => (s: State): State => ({ ...s, scene })
export const replayIntro = (s: State): State => ({ ...s, scene: 'intro', introNonce: s.introNonce + 1 })
export const toggleTicker = (s: State): State => ({ ...s, showTicker: !s.showTicker })
export const toggleRaceHints = (s: State): State => ({ ...s, showRaceHints: !s.showRaceHints })

// ---------- Spieler & Teams ----------

export const addPlayers = (names: string[]) => (s: State): State => {
  const fresh: Player[] = names
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name) => ({ id: uid(), name }))
  return { ...s, players: [...s.players, ...fresh] }
}

export const renamePlayer = (id: string, name: string) => (s: State): State => ({
  ...s,
  players: s.players.map((p) => (p.id === id ? { ...p, name } : p)),
})

export const removePlayer = (id: string) => (s: State): State => ({
  ...s,
  players: s.players.filter((p) => p.id !== id),
  teams: s.teams.map((t) => ({ ...t, playerIds: t.playerIds.filter((p) => p !== id) })),
})

/** Ändert die Teamanzahl; die Auslosung beginnt dabei von vorn. */
export const setTeamCount = (count: number) => (s: State): State => {
  const teams = makeTeams(count, s.teams)
  const ids = new Set(teams.map((t) => t.id))
  return {
    ...s,
    teams,
    wheel: { spinId: s.wheel.spinId, targetPlayerId: null },
    games: s.games.map((g) =>
      g.result ? { ...g, result: { places: g.result.places.map((p) => p.filter((t) => ids.has(t))) } } : g,
    ),
    adjustments: s.adjustments.filter((a) => ids.has(a.teamId)),
  }
}

export const updateTeam = (id: string, patch: Partial<Pick<Team, 'name' | 'color'>>) => (s: State): State => ({
  ...s,
  teams: s.teams.map((t) => (t.id === id ? { ...t, ...patch } : t)),
})

export function unassignedPlayers(s: State): Player[] {
  const taken = new Set(s.teams.flatMap((t) => t.playerIds))
  return s.players.filter((p) => !taken.has(p.id))
}

/** Reihum: das kleinste Team ist dran, bei Gleichstand das vordere. */
export function nextTeamIndex(teams: Team[]): number {
  let best = 0
  teams.forEach((t, i) => {
    if (t.playerIds.length < teams[best].playerIds.length) best = i
  })
  return best
}

const assign = (s: State, playerId: string): Team[] => {
  const idx = nextTeamIndex(s.teams)
  return s.teams.map((t, i) => (i === idx ? { ...t, playerIds: [...t.playerIds, playerId] } : t))
}

/** Ein Dreh: zieht zufällig einen freien Spieler und teilt ihn dem nächsten Team zu. */
export const spinWheel = (random: () => number = Math.random) => (s: State): State => {
  const free = unassignedPlayers(s)
  if (free.length === 0) return s
  const player = free[Math.floor(random() * free.length)]
  return {
    ...s,
    scene: 'wheel',
    teams: assign(s, player.id),
    wheel: { spinId: s.wheel.spinId + 1, targetPlayerId: player.id },
  }
}

/** Verteilt alle restlichen Spieler ohne Rad-Animation. */
export const assignRest = (random: () => number = Math.random) => (s: State): State => {
  let next = s
  const free = [...unassignedPlayers(s)]
  while (free.length) {
    const [player] = free.splice(Math.floor(random() * free.length), 1)
    next = { ...next, teams: assign(next, player.id) }
  }
  return { ...next, wheel: { ...next.wheel, targetPlayerId: null } }
}

export const movePlayer = (playerId: string, teamId: string | null) => (s: State): State => ({
  ...s,
  wheel: { ...s.wheel, targetPlayerId: null },
  teams: s.teams.map((t) => {
    const without = t.playerIds.filter((p) => p !== playerId)
    return { ...t, playerIds: t.id === teamId ? [...without, playerId] : without }
  }),
})

export const clearAssignment = (s: State): State => ({
  ...s,
  teams: s.teams.map((t) => ({ ...t, playerIds: [] })),
  wheel: { ...s.wheel, targetPlayerId: null },
})

// ---------- Spiele & Wertung ----------

export const setVariant = (id: string, variant: string) => (s: State): State => ({
  ...s,
  games: s.games.map((g) => (g.id === id ? { ...g, variant } : g)),
})

/**
 * Verschiebt ein Spiel um einen Platz nach oben (-1) oder unten (+1). Gewertete
 * Spiele bleiben fest und werden übersprungen, damit kein gespieltes Spiel
 * nachträglich zum Finale wird oder aufhört, eines zu sein.
 */
export const shiftGame = (id: string, dir: -1 | 1) => (s: State): State => {
  const from = s.games.findIndex((g) => g.id === id)
  if (from < 0 || s.games[from].result) return s
  let to = from + dir
  while (s.games[to]?.result) to += dir
  if (to < 0 || to >= s.games.length) return s
  const games = [...s.games]
  ;[games[from], games[to]] = [games[to], games[from]]
  return { ...s, games }
}

export const updateScoring = (patch: Partial<State['scoring']>) => (s: State): State => ({
  ...s,
  scoring: { ...s.scoring, ...patch },
})

/** Deckt ein Spiel auf und zeigt es einmal groß auf der Show. */
export const revealGame = (id: string) => (s: State): State => ({
  ...s,
  scene: 'games',
  games: s.games.map((g) => (g.id === id ? { ...g, revealed: true } : g)),
  spotlight: { nonce: s.spotlight.nonce + 1, gameId: id },
})

export const hideGame = (id: string) => (s: State): State => ({
  ...s,
  games: s.games.map((g) => (g.id === id ? { ...g, revealed: false } : g)),
})

/** Schaltet ein Team auf einem Platz (0-basiert) um; ein Team steht nie auf zwei Plätzen. */
export const togglePlace = (gameId: string, place: number, teamId: string) => (s: State): State => ({
  ...s,
  games: s.games.map((g) => {
    if (g.id !== gameId) return g
    const cur = g.result?.places ?? []
    const has = cur[place]?.includes(teamId) ?? false
    const places = Array.from({ length: Math.max(cur.length, place + 1) }, (_, i) => {
      const ids = (cur[i] ?? []).filter((t) => t !== teamId)
      return i === place && !has ? [...ids, teamId] : ids
    })
    const result: GameResult = { places }
    return { ...g, result: places.some((p) => p.length) ? result : null }
  }),
})

export const clearResult = (gameId: string) => (s: State): State => ({
  ...s,
  games: s.games.map((g) => (g.id === gameId ? { ...g, result: null } : g)),
})

export const addAdjustment = (teamId: string, delta: number, note: string) => (s: State): State => ({
  ...s,
  adjustments: [...s.adjustments, { id: uid(), teamId, delta, note }],
})

export const removeAdjustment = (id: string) => (s: State): State => ({
  ...s,
  adjustments: s.adjustments.filter((a) => a.id !== id),
})

// ---------- Reset ----------

export const resetScores = (s: State): State => ({
  ...s,
  games: s.games.map((g) => ({ ...g, result: null, revealed: false })),
  adjustments: [],
  spotlight: { ...s.spotlight, gameId: null },
})

export const resetScoresAndTeams = (s: State): State => clearAssignment(resetScores(s))

/** Alles auf Anfang; Zähler laufen weiter, damit keine Show eine alte Animation abspielt. */
export const resetAll = (s: State): State => ({
  ...initialState(),
  play: freshPlay(s.play.timer.durationMs),
  wheel: { spinId: s.wheel.spinId, targetPlayerId: null },
  spotlight: { nonce: s.spotlight.nonce, gameId: null },
  introNonce: s.introNonce,
})

/**
 * Schreibt eine Rangfolge aus Rundenpunkten (z. B. vom Buzzer) als Ergebnis in
 * ein Spiel. Gleiche Punktzahl heißt geteilter Platz; der nächste Platz folgt
 * direkt darauf (3, 3, 1 → Platz 1, 1, 2).
 */
export const setResultFromScores = (gameId: string, scores: Record<string, number>) => (s: State): State => {
  const distinct = [...new Set(s.teams.map((t) => scores[t.id] ?? 0))].sort((a, b) => b - a)
  const places = distinct.map((value) => s.teams.filter((t) => (scores[t.id] ?? 0) === value).map((t) => t.id))
  return { ...s, games: s.games.map((g) => (g.id === gameId ? { ...g, result: { places } } : g)) }
}

// ---------- Spiel mit eigener Seite (z. B. Buzzer-Quiz) ----------

/** Startet ein Spiel auf der Spielseite: aufdecken, Szene wechseln, Timer bereitstellen. */
export const startPlay = (gameId: string) => (s: State): State => ({
  ...s,
  scene: 'play',
  games: s.games.map((g) => (g.id === gameId ? { ...g, revealed: true } : g)),
  play: { ...freshPlay(s.play.timer.durationMs), gameId },
})

/** Zeigt eine Frage; Antwort und Zusatzinfo bleiben bis zur Auflösung geheim. */
export const showQuestion = (view: Omit<QuizView, 'answer' | 'info' | 'phase'>) => (s: State): State => ({
  ...s,
  play: { ...s.play, quiz: { ...view, answer: null, info: null, phase: 'question' } },
})

export const revealAnswer = (answer: string, info: string | null) => (s: State): State =>
  s.play.quiz ? { ...s, play: { ...s.play, quiz: { ...s.play.quiz, answer, info, phase: 'answer' } } } : s

/** Antwort wieder ausblenden, die Frage läuft weiter (z. B. nach versehentlichem „Richtig“). */
export const reopenQuestion = (s: State): State =>
  s.play.quiz ? { ...s, play: { ...s.play, quiz: { ...s.play.quiz, answer: null, info: null, phase: 'question' } } } : s

/** Beendet das Spiel: Rundenpunkte werden zur Platzierung, danach die Tabelle. */
export const endPlay = (scores: Record<string, number>) => (s: State): State => {
  const gameId = s.play.gameId
  const withResult = gameId ? setResultFromScores(gameId, scores)(s) : s
  return { ...withResult, scene: 'scoreboard', play: freshPlay(s.play.timer.durationMs) }
}

/** Spielseite ohne Wertung verlassen */
export const leavePlay = (s: State): State => ({ ...s, scene: 'games', play: freshPlay(s.play.timer.durationMs) })

// ---------- Timer (nur zur Orientierung des Hosts) ----------

export function timerElapsed(t: Play['timer'], now: number): number {
  return t.elapsedMs + (t.startedAt !== null ? Math.max(0, now - t.startedAt) : 0)
}

export const timerStart = (now: number) => (s: State): State =>
  s.play.timer.startedAt !== null ? s : { ...s, play: { ...s.play, timer: { ...s.play.timer, startedAt: now } } }

export const timerPause = (now: number) => (s: State): State =>
  s.play.timer.startedAt === null
    ? s
    : { ...s, play: { ...s.play, timer: { ...s.play.timer, startedAt: null, elapsedMs: timerElapsed(s.play.timer, now) } } }

export const timerReset = (s: State): State => ({
  ...s,
  play: { ...s.play, timer: { ...s.play.timer, startedAt: null, elapsedMs: 0 } },
})

export const timerSetDuration = (minutes: number) => (s: State): State => ({
  ...s,
  play: { ...s.play, timer: { ...s.play.timer, durationMs: Math.max(1, minutes) * 60 * 1000 } },
})
