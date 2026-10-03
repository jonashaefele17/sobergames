import type { Scoring, State, Team } from '../store/types'

/** Das letzte Spiel ist das Finale; der Faktor hängt am Platz in der Liste, nicht am Spiel. */
export function multiplier(index: number, total: number, scoring: Scoring): number {
  return index === total - 1 ? scoring.finaleFactor : 1
}

/** Punkte pro Platz für das Spiel an Position `index`, z. B. [3, 2, 1] oder im Finale [9, 6, 3]. */
export function gamePoints(index: number, state: State): number[] {
  const m = multiplier(index, state.games.length, state.scoring)
  return state.scoring.placePoints.map((p) => p * m)
}

/** Punkte für einen Platz (0-basiert); Plätze ohne Eintrag zählen 0. */
export const pointsFor = (points: number[], place: number) => points[place] ?? 0

export interface Standing {
  team: Team
  points: number
  wins: number
  rank: number
}

export function teamPoints(state: State): Record<string, { points: number; wins: number }> {
  const out: Record<string, { points: number; wins: number }> = {}
  for (const t of state.teams) out[t.id] = { points: 0, wins: 0 }
  state.games.forEach((g, i) => {
    if (!g.result) return
    const pts = gamePoints(i, state)
    g.result.places.forEach((ids, place) => {
      for (const id of ids) {
        if (!out[id]) continue
        out[id].points += pointsFor(pts, place)
        if (place === 0) out[id].wins += 1
      }
    })
  })
  for (const a of state.adjustments) {
    if (out[a.teamId]) out[a.teamId].points += a.delta
  }
  return out
}

/** Tabelle: nach Punkten, bei Gleichstand nach Siegen; gleicher Rang bei völligem Gleichstand. */
export function standings(state: State): Standing[] {
  const pts = teamPoints(state)
  const rows = state.teams
    .map((team) => ({ team, ...pts[team.id], rank: 0 }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
  rows.forEach((r, i) => {
    const prev = rows[i - 1]
    r.rank = prev && prev.points === r.points && prev.wins === r.wins ? prev.rank : i + 1
  })
  return rows
}

/** Indizes der noch nicht gewerteten Spiele, in Spielreihenfolge. */
export function openGames(state: State): number[] {
  return state.games.flatMap((g, i) => (g.result ? [] : [i]))
}

/** Größter Abstand, den ein Spiel zwischen zwei Teams bewegen kann (Platz 1 gegen letzten Platz). */
export function gameSwing(index: number, state: State): number {
  const pts = gamePoints(index, state)
  return pointsFor(pts, 0) - pointsFor(pts, state.teams.length - 1)
}

/** Größter Rückstand, der in den offenen Spielen noch aufzuholen ist. */
export function maxSwing(state: State, games: number[] = openGames(state)): number {
  return games.reduce((sum, i) => sum + gameSwing(i, state), 0)
}
