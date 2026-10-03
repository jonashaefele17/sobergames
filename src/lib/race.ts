import type { State, Team } from '../store/types'
import { gamePoints, maxSwing, openGames, pointsFor, standings } from './scoring'

export interface Matchball {
  team: Team
  /** schlechtester Platz (0-basiert), der im nächsten Spiel schon reicht */
  clinchPlace: number
}

export interface Race {
  status: 'open' | 'matchball' | 'decided'
  decidedFor: Team | null
  /** Index des nächsten offenen Spiels, null wenn alle gewertet sind */
  nextGame: number | null
  matchball: Matchball[]
  /** Teams, die noch Gesamtsieger werden können */
  contenders: Team[]
  /** Spielnummer (ab 1), nach der es frühestens entschieden sein kann; null wenn schon entschieden */
  earliestEnd: number | null
}

/** Ist `team` mit diesem Punktestand nicht mehr einzuholen, wenn nur noch `rest` offen ist? */
function clinched(points: Record<string, number>, teamId: string, rest: number[], state: State): boolean {
  const swing = maxSwing(state, rest)
  return Object.entries(points).every(([id, p]) => id === teamId || points[teamId] - p > swing)
}

/**
 * Exakte Aussagen zum Titelrennen. Geteilte Plätze lässt die Rechnung beim
 * „ungünstigsten Ausgang“ außen vor: Der stärkste Verfolger holt den besten
 * Platz, den das betrachtete Team nicht selbst belegt.
 */
export function race(state: State): Race {
  const table = standings(state)
  const points: Record<string, number> = Object.fromEntries(table.map((r) => [r.team.id, r.points]))
  const open = openGames(state)
  const nextGame = open[0] ?? null
  const result: Race = { status: 'open', decidedFor: null, nextGame, matchball: [], contenders: [], earliestEnd: null }
  if (table.length < 2) return result

  const leader = table[0].team
  if (clinched(points, leader.id, open, state)) {
    return { ...result, status: 'decided', decidedFor: leader, contenders: [leader] }
  }

  // Wer kann noch gewinnen? Bestfall: überall Erster, alle anderen überall Letzte.
  const best = open.reduce((s, i) => s + pointsFor(gamePoints(i, state), 0), 0)
  const worst = open.reduce((s, i) => s + pointsFor(gamePoints(i, state), state.teams.length - 1), 0)
  result.contenders = table
    .filter((r) => table.every((o) => o.team.id === r.team.id || r.points + best >= o.points + worst))
    .map((r) => r.team)

  // Matchball: Reicht im nächsten Spiel ein Platz, egal wie die anderen abschneiden?
  if (nextGame !== null) {
    const pts = gamePoints(nextGame, state)
    const rest = open.slice(1)
    for (const row of table) {
      let clinchPlace = -1
      for (let place = state.teams.length - 1; place >= 0 && clinchPlace < 0; place--) {
        const rivalPlace = place === 0 ? 1 : 0
        const after = { ...points }
        for (const id of Object.keys(after)) {
          after[id] += id === row.team.id ? pointsFor(pts, place) : pointsFor(pts, rivalPlace)
        }
        if (clinched(after, row.team.id, rest, state)) clinchPlace = place
      }
      if (clinchPlace >= 0) result.matchball.push({ team: row.team, clinchPlace })
    }
  }
  if (result.matchball.length) result.status = 'matchball'

  // Frühestes Ende: Spitzenreiter gewinnt alles, der knappste Verfolger wird jeweils Zweiter.
  const sim = { ...points }
  for (let k = 0; k < open.length; k++) {
    const pts = gamePoints(open[k], state)
    const rival = Object.keys(sim)
      .filter((id) => id !== leader.id)
      .sort((a, b) => sim[b] - sim[a])[0]
    for (const id of Object.keys(sim)) {
      sim[id] += pointsFor(pts, id === leader.id ? 0 : id === rival ? 1 : state.teams.length - 1)
    }
    if (clinched(sim, leader.id, open.slice(k + 1), state)) {
      result.earliestEnd = open[k] + 1
      break
    }
  }
  return result
}
