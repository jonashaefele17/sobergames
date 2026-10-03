import { describe, expect, it } from 'vitest'
import * as act from './actions'
import { race } from './race'
import { gamePoints, maxSwing, standings } from './scoring'
import type { State } from '../store/types'

function setup(): State {
  let s = act.initialState()
  s = act.addPlayers(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'])(s)
  return s
}

/** Wertet Spiel `index` mit der Reihenfolge der Teams (Platz 1, 2, 3 …). */
function play(s: State, index: number, order: string[]): State {
  return order.reduce((acc, teamId, place) => act.togglePlace(acc.games[index].id, place, teamId)(acc), s)
}

const pts = (s: State) => Object.fromEntries(standings(s).map((r) => [r.team.id, r.points]))

describe('Wertung', () => {
  it('13 Spiele, 3/2/1 normal und 9/6/3 im Finale', () => {
    const s = setup()
    expect(s.games).toHaveLength(13)
    expect(gamePoints(0, s)).toEqual([3, 2, 1])
    expect(gamePoints(12, s)).toEqual([9, 6, 3])
    const [a, b, c] = s.teams.map((t) => t.id)
    const after = play(play(s, 0, [a, b, c]), 12, [c, b, a])
    expect(pts(after)).toEqual({ [a]: 6, [b]: 8, [c]: 10 })
  })

  it('geteilte Plätze zählen voll, ein Team steht nie auf zwei Plätzen', () => {
    let s = setup()
    const [a, b, c] = s.teams.map((t) => t.id)
    const g = s.games[0].id
    s = act.togglePlace(g, 0, a)(s)
    s = act.togglePlace(g, 0, b)(s)
    s = act.togglePlace(g, 1, c)(s)
    expect(pts(s)).toEqual({ [a]: 3, [b]: 3, [c]: 2 })
    s = act.togglePlace(g, 2, a)(s)
    expect(s.games[0].result?.places).toEqual([[b], [c], [a]])
    for (const [place, id] of [[1, c], [0, b], [2, a]] as const) s = act.togglePlace(g, place, id)(s)
    expect(s.games[0].result).toBeNull()
  })

  it('Korrekturen und Gleichstand nach Siegen', () => {
    let s = setup()
    const [a, b] = s.teams.map((t) => t.id)
    s = act.togglePlace(s.games[0].id, 0, a)(s)
    s = act.addAdjustment(b, 3, 'Bonus')(s)
    const table = standings(s)
    expect(table[0].team.id).toBe(a) // gleiche Punkte, mehr Siege
    expect(table[1].points).toBe(3)
  })
})

describe('Reihenfolge', () => {
  it('Finale hängt am letzten Platz, gewertete Spiele bleiben fest', () => {
    let s = setup()
    const [a, b, c] = s.teams.map((t) => t.id)
    const ids = s.games.map((g) => g.id)
    s = play(s, 4, [a, b, c])
    // Spiel 4 überspringt das gewertete Spiel 5
    s = act.shiftGame(ids[3], 1)(s)
    expect(s.games[5].id).toBe(ids[3])
    expect(s.games[4].id).toBe(ids[4])
    // gewertetes Spiel bewegt sich nicht
    expect(act.shiftGame(ids[4], 1)(s)).toBe(s)
    // Spiel 12 ans Ende: es wird zum Finale
    s = act.shiftGame(ids[11], 1)(s)
    expect(s.games[12].id).toBe(ids[11])
    s = play(s, 12, [b, c, a])
    expect(pts(s)[b]).toBe(2 + 9)
    // am Rand passiert nichts
    expect(act.shiftGame(s.games[0].id, -1)(s)).toBe(s)
  })
})

describe('Rennen', () => {
  it('am Anfang offen, frühestens nach Spiel 11 entschieden', () => {
    const s = setup()
    expect(maxSwing(s)).toBe(12 * 2 + 6)
    const r = race(s)
    expect(r.status).toBe('open')
    expect(r.contenders).toHaveLength(3)
    expect(r.earliestEnd).toBe(11)
  })

  it('Matchball mit „Platz 2 reicht“, dann entschieden', () => {
    let s = setup()
    const [a, b, c] = s.teams.map((t) => t.id)
    for (let i = 0; i < 10; i++) s = play(s, i, [a, b, c])
    expect(pts(s)).toEqual({ [a]: 30, [b]: 20, [c]: 10 })
    let r = race(s)
    expect(r.status).toBe('matchball')
    expect(r.nextGame).toBe(10)
    expect(r.matchball).toEqual([{ team: s.teams[0], clinchPlace: 1 }])
    expect(r.contenders.map((t) => t.id)).toEqual([a, b])

    s = play(s, 10, [a, b, c])
    r = race(s)
    expect(r.status).toBe('decided')
    expect(r.decidedFor?.id).toBe(a)
  })
})

describe('Ausgangsstand', () => {
  it('hat feste IDs, damit alle Geräte vor dem ersten Speichern dieselben Teams sehen', () => {
    expect(act.initialState().teams.map((t) => t.id)).toEqual(['team-1', 'team-2', 'team-3'])
    expect(act.initialState().games.map((g) => g.id)).toEqual(act.initialState().games.map((g) => g.id))
  })
})

describe('Altes Format', () => {
  it('wandelt first/second in places um und setzt die neue Wertung', () => {
    const old = {
      ...act.initialState(),
      scoring: { mode: 'placement', preset: 'tiers', placeFirst: 3, placeSecond: 1 },
      games: [{ id: 'g1', name: 'Alt', category: '', weight: 2, revealed: true, result: { first: ['x'], second: ['y'] } }],
    } as unknown as State
    const s = act.normalize(old)
    expect(s.games[0].result).toEqual({ places: [['x'], ['y']] })
    expect(s.scoring).toEqual({ placePoints: [3, 2, 1], finaleFactor: 3 })
    expect(s.showRaceHints).toBe(true)
  })
})

describe('Auslosung', () => {
  it('verteilt reihum und gleichmäßig', () => {
    let s = setup()
    for (let i = 0; i < 10; i++) s = act.spinWheel(() => 0)(s)
    expect(s.teams.map((t) => t.playerIds.length)).toEqual([4, 3, 3])
    expect(act.unassignedPlayers(s)).toEqual([])
    expect(s.wheel.spinId).toBe(10)
    expect(act.spinWheel()(s)).toBe(s)
  })

  it('Rest verteilen, verschieben, Resets', () => {
    let s = act.assignRest()(act.spinWheel()(setup()))
    expect(new Set(s.teams.flatMap((t) => t.playerIds)).size).toBe(10)
    const p = s.teams[0].playerIds[0]
    s = act.movePlayer(p, s.teams[2].id)(s)
    expect(s.teams[2].playerIds).toContain(p)
    expect(s.teams[0].playerIds).not.toContain(p)
    s = act.togglePlace(s.games[0].id, 0, s.teams[0].id)(s)
    s = act.resetScores(s)
    expect(s.games[0].result).toBeNull()
    expect(s.teams[2].playerIds.length).toBeGreaterThan(0)
    s = act.resetScoresAndTeams(s)
    expect(s.teams.every((t) => t.playerIds.length === 0)).toBe(true)
    expect(s.players).toHaveLength(10)
    expect(act.resetAll(s).players).toEqual([])
  })
})
