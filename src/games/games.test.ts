import { describe, expect, it } from 'vitest'
import * as act from '../lib/actions'
import { standings } from '../lib/scoring'
import type { State } from '../store/types'
import { clockOffset } from '../lib/clock'
import { GAMES, gameKind, gameName } from './catalog'
import { formatClock, formatStopwatch } from './common/time'
import { addRound, hasEntries, reached, removeRound, scoreData, setShot, setShotCount, setTarget, teamShots, totals, undoRound } from './score/logic'
import { setTime, start, stop, stopwatchData } from './stopwatch/logic'

const play = (id: string): State => act.startPlay(id)(act.initialState())
const ids = (s: State) => s.teams.map((t) => t.id)

describe('Punktetafel', () => {
  it('Runden buchen, Summen, Rückgängig und einzelne Buchung löschen', () => {
    let s = play('scribble-rush')
    const [a, b, c] = ids(s)
    s = addRound({ [a]: 7, [b]: 12, [c]: 0 })(s)
    s = addRound({ [a]: 5 })(s)
    expect(totals(scoreData(s), ids(s))).toEqual({ [a]: 12, [b]: 12, [c]: 0 })
    expect(scoreData(s).rounds[0].points).toEqual({ [a]: 7, [b]: 12 }) // Nullen werden nicht gespeichert
    expect(addRound({ [a]: 0 })(s)).toBe(s) // leere Buchung

    const first = scoreData(s).rounds[0].id
    expect(totals(scoreData(removeRound(first)(s)), ids(s))[b]).toBe(0)
    expect(scoreData(undoRound(s)).rounds).toHaveLength(1)
  })

  it('Zielpunktzahl aus dem Katalog, änderbar, Ziel erreicht', () => {
    let s = play('last-cup-standing')
    const [a, b] = ids(s)
    expect(scoreData(s).target).toBe(5)
    for (let i = 0; i < 4; i++) s = addRound({ [a]: 1 })(s)
    s = addRound({ [b]: 1 })(s)
    expect(reached(scoreData(s), ids(s))).toEqual([])
    s = addRound({ [a]: 1 })(s)
    expect(reached(scoreData(s), ids(s))).toEqual([a])
    expect(reached(scoreData(setTarget(null)(s)), ids(s))).toEqual([])
    expect(scoreData(setTarget(3)(s)).target).toBe(3)
  })

  it('Abzüge sind möglich, Wertung nach Punkten', () => {
    let s = play('mein-team-kann')
    const [a, b, c] = ids(s)
    s = addRound({ [a]: 2, [b]: -1 })(s)
    s = addRound({ [c]: 1 })(s)
    s = act.endPlay(totals(scoreData(s), ids(s)))(s)
    expect(s.scene).toBe('scoreboard')
    expect(s.games.find((g) => g.id === 'mein-team-kann')?.result?.places).toEqual([[a], [c], [b]])
    // Finale zählt dreifach
    expect(standings(s).map((r) => r.points)).toEqual([9, 6, 3])
  })

  it('jede Punktetafel hat einen Modus', () => {
    for (const d of GAMES.filter((g) => g.kind === 'score')) expect(d.score?.mode).toBeTruthy()
  })
})

describe('Stoppuhr', () => {
  it('starten, stoppen, nur eine Uhr gleichzeitig, korrigieren', () => {
    let s = play('ex-oder-zieh')
    const [a, b] = ids(s)
    s = start(a, 1000)(s)
    expect(start(b, 1500)(s)).toBe(s)
    s = stop(4250)(s)
    expect(stopwatchData(s)).toEqual({ times: { [a]: 3250 }, running: null })
    expect(stop(9000)(s)).toBe(s)
    s = setTime(a, 3000)(s)
    expect(stopwatchData(s).times[a]).toBe(3000)
    expect(stopwatchData(setTime(a, null)(s)).times).toEqual({})
  })

  it('kürzeste Zeit gewinnt, Gleichstand teilt den Platz, ohne Zeit ist letzter', () => {
    let s = play('ex-oder-zieh')
    const [a, b, c] = ids(s)
    s = act.endPlayRanked({ [a]: 5200, [b]: 3100 }, true)(s)
    expect(s.games.find((g) => g.id === 'ex-oder-zieh')?.result?.places).toEqual([[b], [a], [c]])

    let t = play('build-it')
    t = act.endPlayRanked({ [a]: 40, [b]: 55, [c]: 55 }, false)(t)
    expect(t.games.find((g) => g.id === 'build-it')?.result?.places).toEqual([[b, c], [a]])
  })
})

describe('Spielstart', () => {
  it('Timer-Voreinstellung kommt aus dem Katalog, Daten beginnen leer', () => {
    expect(play('build-it').play.timer.durationMs).toBe(5 * 60 * 1000)
    expect(play('allgemeinwissen').play.timer.durationMs).toBe(25 * 60 * 1000)
    expect(play('build-it').play.data).toEqual({})
    const s = act.setPlayValue('team-1', 42)(play('build-it'))
    expect(s.play.data.values).toEqual({ 'team-1': 42 })
    expect(act.setPlayValue('team-1', null)(s).play.data.values).toEqual({})
  })
})

describe('Zeitanzeige', () => {
  it('Uhr und Stoppuhr', () => {
    expect(formatClock(5 * 60 * 1000)).toBe('05:00')
    expect(formatClock(-76_000)).toBe('01:16')
    expect(formatStopwatch(3250)).toBe('3,25')
    expect(formatStopwatch(65_430)).toBe('1:05,43')
  })
})

describe('Arschbolzen: Versuche einzeln', () => {
  it('eintragen, ändern, leeren, Summe und Wertung', () => {
    let s = play('arschbolzen')
    const [a, b, c] = ids(s)
    expect(scoreData(s).shotCount).toBe(6)
    expect(hasEntries(scoreData(s))).toBe(false)
    s = setShot(a, 0, 3)(s)
    s = setShot(a, 1, 0)(s)
    s = setShot(a, 4, 2)(s) // Versuche sind unabhängig, auch außer der Reihe
    s = setShot(b, 0, 1)(s)
    expect(teamShots(scoreData(s), a)).toEqual([3, 0, null, null, 2, null])
    expect(hasEntries(scoreData(s))).toBe(true)
    expect(totals(scoreData(s), ids(s))).toEqual({ [a]: 5, [b]: 1, [c]: 0 })

    s = setShot(a, 0, 1)(s) // ändern
    s = setShot(a, 4, null)(s) // leeren
    expect(totals(scoreData(s), ids(s))[a]).toBe(1)
    expect(setShot(a, 9, 3)(s).play.data.score).toEqual(s.play.data.score) // außerhalb der Versuche

    s = act.endPlay(totals(scoreData(s), ids(s)))(s)
    expect(s.games.find((g) => g.id === 'arschbolzen')?.result?.places).toEqual([[a, b], [c]])
  })

  it('Zahl der Versuche ändern schneidet überzählige ab', () => {
    let s = play('arschbolzen')
    const [a] = ids(s)
    for (let i = 0; i < 6; i++) s = setShot(a, i, 2)(s)
    s = setShotCount(4)(s)
    expect(teamShots(scoreData(s), a)).toEqual([2, 2, 2, 2])
    expect(totals(scoreData(s), ids(s))[a]).toBe(8)
    expect(teamShots(scoreData(setShotCount(8)(s)), a)).toHaveLength(8)
  })

  it('Kippmoment hat keine eigene Spielseite', () => {
    const s = act.initialState()
    const game = s.games.find((g) => g.id === 'arschbolzen')!
    expect(gameKind(game)).toBe('score')
    const kipp = { ...game, variant: 'kippmoment' }
    expect(gameName(kipp)).toBe('Kippmoment')
    expect(gameKind(kipp)).toBe('plain')
  })
})

describe('Gemeinsame Uhr', () => {
  it('nimmt die Messung mit der kürzesten Laufzeit und verortet die Antwort in deren Mitte', () => {
    // eigene Uhr geht 5 s nach: Server 105 000, lokal 100 000
    const samples = [
      { sent: 100_000, received: 100_400, server: 105_300 }, // langsam und schief
      { sent: 101_000, received: 101_040, server: 106_020 }, // 40 ms Laufzeit
      { sent: 102_000, received: 102_200, server: 107_050 },
    ]
    expect(clockOffset(samples)).toBe(5000)
    expect(clockOffset([])).toBe(0)
  })
})
