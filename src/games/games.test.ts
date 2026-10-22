import { describe, expect, it } from 'vitest'
import * as act from '../lib/actions'
import { standings } from '../lib/scoring'
import type { State } from '../store/types'
import { clockOffset } from '../lib/clock'
import { GAMES, gameKind, gameName } from './catalog'
import { formatClock, formatStopwatch } from './common/time'
import { adjustPoints, award, detectFormat, estimateData, estimateTotals, formatAnswer, formatDate, formatDistance, groupDigits, maskDate, maskYear, parseAnswer, parseDate, parseNumber, resetQuestion, revealGuess, revealSolution, setMode, setSubmitted } from './estimate/logic'
import { addRound, hasEntries, reached, removeRound, scoreData, setShot, setShotCount, setTarget, teamShots, totals, undoRound } from './score/logic'
import { difference, measureData, measurePage, measureTotals, pageCount, pageItems, setItems, setWeight, showPage } from './measure/logic'
import { awarded, awardTotals, toggleAward } from './prompt/logic'
import { setTime, start, stop, stopwatchData } from './stopwatch/logic'
import * as ch from './challenge/logic'

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
    let s = play('scribble-rush')
    const [a, b, c] = ids(s)
    s = addRound({ [a]: 2, [b]: -1 })(s)
    s = addRound({ [c]: 1 })(s)
    s = act.endPlay(totals(scoreData(s), ids(s)))(s)
    expect(s.scene).toBe('scoreboard')
    expect(s.games.find((g) => g.id === 'scribble-rush')?.result?.places).toEqual([[a], [c], [b]])
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

describe('Wer würde eher: Punkt je Frage und Team', () => {
  it('umschalten, mehrere Teams pro Frage, Summe und Wertung', () => {
    let s = play('wer-wuerde-eher')
    const [a, b, c] = ids(s)
    s = toggleAward(0, a)(s)
    s = toggleAward(0, b)(s)
    s = toggleAward(1, a)(s)
    s = toggleAward(1, c)(s)
    s = toggleAward(1, c)(s) // wieder weg
    expect(awarded(s, 0)).toEqual([a, b])
    expect(awarded(s, 1)).toEqual([a])
    expect(awarded(s, 5)).toEqual([])
    expect(awardTotals(s)).toEqual({ [a]: 2, [b]: 1, [c]: 0 })
    s = act.endPlay(awardTotals(s))(s)
    expect(s.games.find((g) => g.id === 'wer-wuerde-eher')?.result?.places).toEqual([[a], [b], [c]])
  })
})

describe('Perfect Cut: Differenzen', () => {
  it('Differenz je Objekt, Summe erst wenn alles gewogen ist, kleinste gewinnt', () => {
    let s = play('perfect-cut')
    const [a, b, c] = ids(s)
    const x = { id: 'x', name: 'Birne' }
    const y = { id: 'y', name: 'Apfel' }
    s = setItems([x, y])(s)
    expect(setItems([x, y])(s).play.data.measure).toBe(s.play.data.measure) // unverändert: kein neuer Stand

    s = setWeight(x.id, a, 0, 102)(s)
    expect(difference(measureData(s), x.id, a)).toBeNull() // zweite Hälfte fehlt
    s = setWeight(x.id, a, 1, 98.5)(s)
    expect(difference(measureData(s), x.id, a)).toBe(3.5)
    expect(measureTotals(measureData(s), ids(s))).toEqual({}) // Apfel fehlt noch

    s = setWeight(y.id, a, 0, 80)(setWeight(y.id, a, 1, 81)(s))
    for (const [item, w0, w1] of [[x.id, 100, 100], [y.id, 70, 76]] as const) s = setWeight(item, b, 0, w0)(setWeight(item, b, 1, w1)(s))
    expect(measureTotals(measureData(s), ids(s))).toEqual({ [a]: 4.5, [b]: 6 })

    const ended = act.endPlayRanked(measureTotals(measureData(s), ids(s)), true)(s)
    expect(ended.games.find((g) => g.id === 'perfect-cut')?.result?.places).toEqual([[a], [b], [c]])

    // Objekt im Setup gelöscht und eins ergänzt: alte Werte bleiben, die des gelöschten fallen weg
    s = setItems([x, { id: 'z', name: 'Banane' }])(s)
    expect(measureData(s).weights[y.id]).toBeUndefined()
    expect(difference(measureData(s), x.id, a)).toBe(3.5)
    expect(measureTotals(measureData(s), ids(s))).toEqual({}) // Banane fehlt noch
  })

  it('mehr als 4 Objekte verteilen sich auf Seiten; Eintragen springt zur Seite des Objekts', () => {
    let s = play('perfect-cut')
    const [a] = ids(s)
    const items = Array.from({ length: 8 }, (_, i) => ({ id: `o${i}`, name: `Objekt ${i + 1}` }))
    s = setItems(items)(s)
    expect(pageCount(measureData(s))).toBe(2)
    expect(measurePage(measureData(s))).toBe(0)
    expect(pageItems(measureData(s), 1).map((i) => i.id)).toEqual(['o4', 'o5', 'o6', 'o7'])

    s = setWeight('o5', a, 0, 50)(s)
    expect(measurePage(measureData(s))).toBe(1)
    s = showPage(0)(s)
    expect(measurePage(measureData(s))).toBe(0)
    expect(measurePage(measureData(showPage(7)(s)))).toBe(1) // nicht über die letzte Seite hinaus

    // Objekte weggenommen: die Seite rutscht auf die letzte vorhandene
    s = setItems(items.slice(0, 3))(showPage(1)(s))
    expect(measurePage(measureData(s))).toBe(0)
  })
})

describe('Schätzfragen', () => {
  it('liest Zahlen in deutscher und englischer Schreibweise', () => {
    expect(parseNumber('1.250')).toBe(1250)
    expect(parseNumber('3,5')).toBe(3.5)
    expect(parseNumber('1.250,75')).toBe(1250.75)
    expect(parseNumber('84.000.000')).toBe(84_000_000)
    expect(parseNumber('1250.5')).toBe(1250.5)
    expect(parseNumber(' 42 ')).toBe(42)
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('viel')).toBeNull()
  })

  it('setzt beim Tippen Tausenderpunkte und bleibt lesbar für parseNumber', () => {
    const cases: [string, string, number | null][] = [
      ['84000000', '84.000.000', 84_000_000],
      ['1250,5', '1.250,5', 1250.5],
      ['1250,', '1.250,', 1250],
      ['007', '7', 7],
      ['0', '0', 0],
      ['-1250', '-1.250', -1250],
      ['12a3', '123', 123],
      ['1.2.5.0', '1.250', 1250],
      [',5', '0,5', 0.5],
      ['1,2,3', '1,23', 1.23],
      ['', '', null],
    ]
    for (const [typed, shown, value] of cases) {
      expect(groupDigits(typed)).toBe(shown)
      expect(parseNumber(shown)).toBe(value)
    }
    // Ziffer für Ziffer getippt
    let field = ''
    for (const digit of '1234567') field = groupDigits(field + digit)
    expect(field).toBe('1.234.567')
  })

  it('Nächster bekommt 1 Punkt, gleicher Abstand beide, ohne Schätzung nichts', () => {
    expect(award({ a: 300, b: 350, c: 500 }, 330, 'nearest')).toEqual({ b: 1 })
    expect(award({ a: 320, b: 340, c: 500 }, 330, 'nearest')).toEqual({ a: 1, b: 1 })
    expect(award({ c: 500 }, 330, 'nearest')).toEqual({ c: 1 })
    expect(award({}, 330, 'nearest')).toEqual({})
  })

  it('abgestuft: 2 für den Nächsten, 1 für den Zweitnächsten, Gleichstand teilt die Stufe', () => {
    expect(award({ a: 300, b: 350, c: 500 }, 330, 'graded')).toEqual({ b: 2, a: 1 })
    expect(award({ a: 320, b: 340, c: 500 }, 330, 'graded')).toEqual({ a: 2, b: 2, c: 1 })
  })

  it('Ablauf: Abgaben ohne Zahl, einzeln aufdecken, Lösung, Punkte, Umschalten, Korrektur', () => {
    let s = play('schaetzfragen')
    const [a, b, c] = ids(s)
    s = setSubmitted([b, a])(s)
    expect(estimateData(s).submitted).toEqual([a, b].sort())
    expect(setSubmitted([a, b])(s)).toBe(s) // unverändert: kein neuer Stand
    expect(estimateData(s).guesses).toEqual({}) // noch nichts öffentlich

    s = revealGuess(b, 350)(s)
    expect(estimateData(s).guesses).toEqual({ [b]: 350 }) // nur das aufgedeckte Team

    s = revealSolution(0, 330, { [a]: 300, [b]: 350, [c]: 500 })(s)
    expect(estimateData(s)).toMatchObject({ solution: 330, guesses: { [a]: 300, [b]: 350, [c]: 500 } })
    expect(estimateTotals(s)).toEqual({ [a]: 0, [b]: 1, [c]: 0 })

    s = setMode('graded', 0)(s) // laufende Frage wird neu gewertet
    expect(estimateTotals(s)).toEqual({ [a]: 1, [b]: 2, [c]: 0 })
    s = adjustPoints(c, 1)(s)
    expect(estimateTotals(s)[c]).toBe(1)

    s = resetQuestion(s) // nächste Frage: Punkte bleiben, Rest leer
    expect(estimateData(s)).toMatchObject({ submitted: [], guesses: {}, solution: null, mode: 'graded' })
    expect(estimateTotals(s)).toEqual({ [a]: 1, [b]: 2, [c]: 1 })
  })
})

describe('Schätzfragen: Jahr und Datum', () => {
  it('liest und zeigt ein Datum, auch vor 1970 und in den Jahren 0–99', () => {
    expect(parseDate('01.01.1970')).toBe(0)
    expect(formatDate(parseDate('9.11.1989')!)).toBe('09.11.1989')
    expect(formatDate(parseDate('14.07.1789')!)).toBe('14.07.1789')
    expect(formatDate(parseDate('01.03.0079')!)).toBe('01.03.0079')
    expect(parseDate('29.02.2024')).not.toBeNull()
    expect(parseDate('29.02.2023')).toBeNull()
    expect(parseDate('31.04.2000')).toBeNull()
    expect(parseDate('1989')).toBeNull()
  })

  it('Abstand bei Daten in Tagen, die Wertung bleibt dieselbe', () => {
    const solution = parseDate('09.11.1989')!
    const guesses = { a: parseDate('01.11.1989')!, b: parseDate('09.11.1990')!, c: parseDate('03.10.1990')! }
    expect(guesses.a - solution).toBe(-8)
    expect(award(guesses, solution, 'graded')).toEqual({ a: 2, c: 1 })
    expect(formatDistance(8, 'date')).toBe('8 Tage')
    expect(formatDistance(1, 'date')).toBe('1 Tag')
    expect(formatDistance(-730, 'date')).toBe('730 Tage (≈ 2 Jahre)')
    expect(formatDistance(365, 'date')).toBe('365 Tage (≈ 1 Jahr)')
  })

  it('Jahre ohne Tausenderpunkt, vor Christus mit Minus', () => {
    expect(parseAnswer('1989', 'year')).toBe(1989)
    expect(formatAnswer(1989, 'year')).toBe('1989')
    expect(formatAnswer(1989, 'number')).toBe('1.989')
    expect(formatAnswer(-44, 'year')).toBe('44 v. Chr.')
    expect(parseAnswer('19,5', 'year')).toBeNull()
    expect(formatDistance(1, 'year')).toBe('1 Jahr')
    expect(formatDistance(-12, 'year')).toBe('12 Jahre')
  })

  it('Masken beim Tippen', () => {
    expect(maskDate('09111989')).toBe('09.11.1989')
    expect(maskDate('0911')).toBe('09.11')
    expect(maskDate('9.')).toBe('09')
    expect(maskDate('9.11.1989')).toBe('09.11.1989')
    expect(maskDate('09.1')).toBe('09.1')
    expect(maskDate('091119891234')).toBe('09.11.1989')
    expect(maskYear('19a89')).toBe('1989')
    expect(maskYear('-44')).toBe('-44')
    expect(maskYear('123456')).toBe('1234')
  })

  it('erkennt eingefügte Daten', () => {
    expect(detectFormat('09.11.1989')).toBe('date')
    expect(detectFormat('1.250')).toBeUndefined()
    expect(detectFormat('157')).toBeUndefined()
  })
})

describe('Mein Team kann', () => {
  const task = (s: State, type: 'count' | 'list' | 'free' | 'time', timers?: number) => ch.startChallenge(0, 10, 'Aufgabe', { type, timers })(s)
  const run = (s: State) => ch.challengeData(s).current!

  it('Zählen: Runden nach Teamgröße, Summe gegen Ziel, Wertung 2 bzw. 1 für die anderen', () => {
    let s = play('mein-team-kann')
    const [a, b, c] = ids(s)
    s = { ...s, teams: s.teams.map((t) => (t.id === a ? { ...t, playerIds: ['p1', 'p2', 'p3', 'p4'] } : t)) }
    s = task(s, 'count')
    expect(ch.reached(run(s), 0)).toBeNull() // ohne Ziel kein Vorschlag
    s = ch.setTarget(30)(ch.setTeam(a)(s))
    expect(run(s).counts).toEqual([null, null, null]) // 4 Spieler → 3 Runden
    s = ch.setCount(0, 12)(ch.setCount(1, 10)(s))
    expect(ch.progress(run(s), 0)).toBe(22)
    expect(ch.reached(run(s), 0)).toBe(false)
    s = ch.setCount(2, 8)(s)
    expect(ch.reached(run(s), 0)).toBe(true) // genau das Ziel reicht
    expect(run(ch.setTeam(b)(s)).counts).toEqual([12, 10, 8]) // ohne Spieler 3 Runden, Werte bleiben

    s = ch.decide(true)(s)
    expect(ch.challengeTotals(s)).toEqual({ [a]: 2, [b]: 0, [c]: 0 })
    s = ch.decide(false)(s) // umentschieden: ersetzt, zählt nicht doppelt
    expect(ch.challengeTotals(s)).toEqual({ [a]: 0, [b]: 1, [c]: 1 })
    s = ch.decide(null)(s)
    expect(ch.challengeTotals(s)).toEqual({ [a]: 0, [b]: 0, [c]: 0 })
    expect(ch.challengeData(s).results).toEqual({})
  })

  it('Liste: abhaken, einzeln aufdecken, nicht Genanntes zeigen', () => {
    let s = task(play('mein-team-kann'), 'list')
    s = ch.toggleNamed('Neuer')(ch.toggleNamed('Lahm')(ch.toggleNamed('Klose')(s)))
    expect(ch.visibleNames(run(s))).toEqual([]) // erst zählen
    s = ch.reveal('Lahm')(ch.reveal('Unbekannt')(s))
    expect(ch.visibleNames(run(s))).toEqual(['Lahm'])
    expect(ch.visibleNames(run(ch.setLive(true)(s)))).toEqual(['Klose', 'Lahm', 'Neuer'])
    s = ch.toggleNamed('Lahm')(s) // wieder abgewählt: auch nicht mehr aufgedeckt
    expect(run(s).revealed).toEqual([])
    s = ch.showMissed(['Neuer', 'Lahm', 'Klose', 'Müller'])(s)
    expect(run(s).missed).toEqual(['Lahm', 'Müller'])
    expect(ch.progress(run(s), 0)).toBe(2)
  })

  it('frei: Genanntes ohne Doppelte', () => {
    let s = task(play('mein-team-kann'), 'free')
    s = ch.addNamed(' Nördlingen ')(ch.addNamed('nördlingen')(ch.addNamed('')(s)))
    expect(run(s).named).toEqual(['nördlingen'])
    s = ch.removeNamed('nördlingen')(ch.addNamed('Wemding')(s))
    expect(run(s).named).toEqual(['Wemding'])
  })

  it('Zeit: Timer nacheinander, Summe muss länger sein als die Zielzeit', () => {
    let s = task(play('mein-team-kann'), 'time', 3)
    expect(run(s).timers).toHaveLength(3)
    s = ch.setTarget(60_000)(s)
    s = ch.startTimer(0, 1_000)(s)
    expect(run(ch.startTimer(1, 2_000)(s)).timers[1].startedAt).toBeNull() // nur einer läuft
    s = ch.stopTimer(21_000)(s)
    s = ch.stopTimer(30_000)(ch.startTimer(1, 10_000)(s))
    s = ch.startTimer(2, 40_000)(s)
    expect(ch.progress(run(s), 60_000)).toBe(60_000)
    expect(ch.reached(run(s), 60_000)).toBe(false) // genau die Zielzeit reicht nicht
    expect(ch.reached(run(s), 60_001)).toBe(true)
    s = ch.setTimer(0, 0)(s)
    expect(run(s).timers[0]).toEqual({ ms: 0, startedAt: null })
  })

  it('Wertung als Finale: Punkte ergeben die Platzierung', () => {
    let s = play('mein-team-kann')
    const [a, b, c] = ids(s)
    s = ch.decide(true)(ch.setTeam(a)(task(s, 'free')))
    s = ch.decide(false)(ch.setTeam(a)(ch.startChallenge(1, 10, 'Zwei', { type: 'count' })(s)))
    s = ch.adjustPoints(b, 1)(s)
    expect(ch.challengeTotals(s)).toEqual({ [a]: 2, [b]: 2, [c]: 1 })
    s = act.endPlay(ch.challengeTotals(s))(s)
    expect(s.games.find((g) => g.id === 'mein-team-kann')?.result?.places).toEqual([[a, b], [c]])
    expect(standings(s).map((r) => r.points)).toEqual([9, 9, 6]) // Finale zählt dreifach
  })
})
