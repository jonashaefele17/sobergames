import { describe, expect, it } from 'vitest'
import { applyJudge, applyStartQuestion, initialBuzzer } from '../../buzzer/types'
import * as act from '../../lib/actions'
import type { State } from '../../store/types'
import { GAMES, gameName } from '../catalog'
import { describeBackup, parseBackup, type Backup } from '../../lib/backup'
import { mediaFiles, mediaKind, mediaUrl } from '../common/media'
import { parseQuestions } from './parse'
import { firstSound } from './songPlayer'

describe('Feste Spiele', () => {
  it('13 Spiele in der geplanten Reihenfolge, Allgemeinwissen auf Platz 9, Finale ist Mein Team kann', () => {
    const ids = act.initialState().games.map((g) => g.id)
    expect(ids).toHaveLength(13)
    expect(ids.indexOf('allgemeinwissen')).toBe(8)
    expect(ids[12]).toBe('mein-team-kann')
    expect(new Set(ids).size).toBe(13)
  })

  it('normalize behält die Reihenfolge, verwirft Unbekanntes und ergänzt Fehlendes', () => {
    const raw = {
      games: [
        { id: 'game-1', revealed: false, result: null },
        { id: 'allgemeinwissen', revealed: true, result: null },
        { id: 'last-cup-standing', revealed: false, result: { places: [['team-1']] } },
      ],
    } as unknown as Partial<State>
    const s = act.normalize(raw)
    expect(s.games.slice(0, 2).map((g) => g.id)).toEqual(['allgemeinwissen', 'last-cup-standing'])
    expect(s.games).toHaveLength(GAMES.length)
    expect(s.games[1].result?.places).toEqual([['team-1']])
    expect(s.play.timer.durationMs).toBe(25 * 60 * 1000)
  })

  it('Variante umschalten ändert den Namen', () => {
    let s = act.initialState()
    const game = s.games.find((g) => g.id === 'arschbolzen')!
    expect(gameName(game)).toBe('Arschbolzen')
    s = act.setVariant('arschbolzen', 'kippmoment')(s)
    expect(gameName(s.games.find((g) => g.id === 'arschbolzen')!)).toBe('Kippmoment')
  })
})

describe('Liste einfügen', () => {
  it('Tab, |, leere Zeilen, Kopfzeile und fehlende Antwort', () => {
    const text = [
      'Frage\tAntwort\tInfo',
      'Hauptstadt von Frankreich?\tParis\tSeit 508',
      '',
      '  Wie viele Beine hat eine Spinne? | 8  ',
      'Nur eine Frage ohne Antwort',
      'A | B | C | D',
    ].join('\n')
    expect(parseQuestions(text)).toEqual([
      { question: 'Hauptstadt von Frankreich?', answer: 'Paris', info: 'Seit 508' },
      { question: 'Wie viele Beine hat eine Spinne?', answer: '8', info: '' },
      { question: 'Nur eine Frage ohne Antwort', answer: '', info: '' },
      { question: 'A', answer: 'B', info: 'C | D' },
    ])
  })
})

describe('Quiz-Ablauf', () => {
  it('starten, Frage zeigen ohne Antwort, auflösen, beenden', () => {
    let s = act.startPlay('allgemeinwissen')(act.initialState())
    expect(s.scene).toBe('play')
    expect(s.games.find((g) => g.id === 'allgemeinwissen')?.revealed).toBe(true)
    expect(s.play.quiz).toBeNull()

    s = act.showQuestion({ index: 0, total: 3, text: 'Frage?', imageUrl: null })(s)
    expect(s.play.quiz).toMatchObject({ phase: 'question', answer: null, info: null })

    s = act.revealAnswer('Antwort', 'Info')(s)
    expect(s.play.quiz).toMatchObject({ phase: 'answer', answer: 'Antwort', info: 'Info' })

    const [a, b, c] = s.teams.map((t) => t.id)
    s = act.endPlay({ [a]: 5, [b]: 2, [c]: 5 })(s)
    expect(s.scene).toBe('scoreboard')
    expect(s.play.gameId).toBeNull()
    expect(s.games.find((g) => g.id === 'allgemeinwissen')?.result?.places).toEqual([[a, c], [b]])
  })

  it('Antwort auflösen ohne gezeigte Frage ändert nichts', () => {
    const s = act.initialState()
    expect(act.revealAnswer('x', null)(s)).toBe(s)
  })
})

describe('Timer', () => {
  it('läuft, pausiert, setzt fort und darf überziehen', () => {
    let s = act.timerSetDuration(1)(act.initialState())
    s = act.timerStart(1000)(s)
    expect(act.timerElapsed(s.play.timer, 31_000)).toBe(30_000)
    s = act.timerPause(31_000)(s)
    expect(act.timerElapsed(s.play.timer, 99_000)).toBe(30_000)
    s = act.timerStart(100_000)(s)
    // 30 s + 60 s = 90 s bei 60 s Dauer: 30 s überzogen, nichts wird gesperrt
    expect(s.play.timer.durationMs - act.timerElapsed(s.play.timer, 160_000)).toBe(-30_000)
    expect(act.timerStart(170_000)(s)).toBe(s)
    expect(act.timerElapsed(act.timerReset(s).play.timer, 200_000)).toBe(0)
  })
})

describe('Buzzer im Quiz', () => {
  it('Richtig mit pause schaltet den Buzzer in einem Schritt aus, neue Frage schaltet ihn wieder an', () => {
    const locked = { ...applyStartQuestion(initialBuzzer()), status: 'locked' as const, buzzedTeamId: 'a', excludedTeamIds: ['b'] }
    const s = applyJudge(locked, true, true)!
    expect(s).toMatchObject({ armed: false, status: 'open', roundScores: { a: 1 }, excludedTeamIds: [] })
    expect(applyJudge(locked, false, true)).toMatchObject({ armed: true, excludedTeamIds: ['b', 'a'] })
    expect(applyStartQuestion(s)).toMatchObject({ armed: true, status: 'open', buzzedTeamId: null, excludedTeamIds: [] })
  })
})

describe('Hinweise', () => {
  it('werden nacheinander aufgedeckt und beginnen bei jeder Frage neu', () => {
    let s = act.startPlay('guess-the-location')(act.initialState())
    expect(act.addHint({ kind: 'text', value: 'x' })(s)).toBe(s) // ohne Frage passiert nichts
    s = act.showQuestion({ index: 0, total: 2, text: 'Wo?', imageUrl: null, hints: [{ kind: 'image', value: 'url1' }] })(s)
    s = act.addHint({ kind: 'text', value: 'Tipp' })(s)
    expect(s.play.quiz?.hints).toEqual([
      { kind: 'image', value: 'url1' },
      { kind: 'text', value: 'Tipp' },
    ])
    s = act.showQuestion({ index: 1, total: 2, text: 'Und hier?', imageUrl: null, hints: [] })(s)
    expect(s.play.quiz?.hints).toEqual([])
  })
})

describe('Nur Lösung (Guess the Location)', () => {
  it('eine Zeile pro Ort, optional mit Zusatzinfo, Kopfzeile wird übersprungen', () => {
    expect(parseQuestions('Ort\nParis | Frankreich\n\nRom\tItalien\tEwige Stadt\nTokio', true)).toEqual([
      { question: '', answer: 'Paris', info: 'Frankreich' },
      { question: '', answer: 'Rom', info: 'Italien | Ewige Stadt' },
      { question: '', answer: 'Tokio', info: '' },
    ])
  })
})

describe('Medien aus dem Repo', () => {
  const all = ['media/guess-the-location/a-1.jpg', 'media/guess-the-location/b.PNG', 'media/songs-erraten/s01.mp3', 'media/notiz.txt']

  it('Dateien je Spiel mit Typ', () => {
    expect(mediaFiles('guess-the-location', all)).toEqual([
      { path: 'media/guess-the-location/a-1.jpg', name: 'a-1.jpg', kind: 'image' },
      { path: 'media/guess-the-location/b.PNG', name: 'b.PNG', kind: 'image' },
    ])
    expect(mediaFiles('songs-erraten', all)[0].kind).toBe('audio')
    expect(mediaFiles('allgemeinwissen', all)).toEqual([])
    expect(mediaKind('media/notiz.txt')).toBe('other')
  })

  it('Adresse nur für Pfade im Medienordner', () => {
    expect(mediaUrl('media/guess-the-location/a-1.jpg')).toBe('media/guess-the-location/a-1.jpg')
    expect(mediaUrl('489168fb-14dc.jpg')).toBeNull() // früherer Upload
    expect(mediaUrl(null)).toBeNull()
  })
})

describe('Songs in Stufen', () => {
  const song = { url: 'media/songs-erraten/a.mp3', start: 12, stage: -1, nonce: 0, play: 'stop' as const }
  const shown = act.showQuestion({ index: 0, total: 3, text: '', imageUrl: null, audio: song })(act.initialState())

  it('die Stufen des Katalogs sind aufsteigend', () => {
    const stages = GAMES.find((g) => g.id === 'songs-erraten')!.quiz!.stages!
    expect(stages).toEqual([0.1, 0.5, 2, 8, 15])
    expect([...stages].sort((a, b) => a - b)).toEqual(stages)
  })

  it('findet den ersten hörbaren Ton hinter der Stille am Dateianfang', () => {
    const silent = new Float32Array(1000)
    const late = new Float32Array(1000)
    late.fill(0.2, 400)
    late[100] = 0.004 // Rauschen unter der Schwelle
    expect(firstSound([late])).toBe(400)
    expect(firstSound([silent, late])).toBe(400)
    expect(firstSound([silent])).toBe(0)
    expect(firstSound([Float32Array.from([-0.5, 0, 0])])).toBe(0)
  })

  it('nach dem Zeigen läuft noch nichts', () => {
    expect(shown.play.quiz!.audio).toEqual(song)
  })

  it('nächste Stufe, Wiederholen und Stopp zählen den Auslöser hoch und behalten die Startstelle', () => {
    let s = act.cueAudio('stage', 0)(shown)
    expect(s.play.quiz!.audio).toMatchObject({ stage: 0, nonce: 1, play: 'stage', start: 12 })
    s = act.cueAudio('stage', 0)(s)
    expect(s.play.quiz!.audio).toMatchObject({ stage: 0, nonce: 2, play: 'stage' })
    s = act.cueAudio('stage', 1)(s)
    expect(s.play.quiz!.audio).toMatchObject({ stage: 1, nonce: 3 })
    s = act.cueAudio('stop')(s)
    expect(s.play.quiz!.audio).toMatchObject({ stage: 1, nonce: 4, play: 'stop' })
    s = act.cueAudio('full')(s)
    expect(s.play.quiz!.audio).toMatchObject({ stage: 1, nonce: 5, play: 'full' })
  })

  it('der Song bleibt beim Auflösen erhalten, ohne Song passiert nichts', () => {
    const answered = act.revealAnswer('Titel', null)(act.cueAudio('stage', 2)(shown))
    expect(answered.play.quiz!.audio).toMatchObject({ stage: 2, nonce: 1 })
    const plain = act.showQuestion({ index: 0, total: 1, text: 'F?', imageUrl: null })(act.initialState())
    expect(act.cueAudio('stage', 0)(plain)).toBe(plain)
  })
})

describe('Sicherung', () => {
  it('Sichern und Einlesen ergibt wieder denselben Stand und dieselben Inhalte', () => {
    let s = act.addPlayers(['A', 'B'])(act.initialState())
    s = act.togglePlace('allgemeinwissen', 0, 'team-2')(act.shiftGame('allgemeinwissen', -1)(s))
    const content = { allgemeinwissen: [{ id: 'q1', question: 'F?', answer: 'A', info: '', imagePath: null, hints: [] }] }
    const backup: Backup = { version: 1, createdAt: '2026-10-05T10:00:00.000Z', state: s, content }
    const read = parseBackup(JSON.stringify(backup))
    expect(read.state).toEqual(s)
    expect(read.content).toEqual(content)
    expect(describeBackup(read)).toContain('2 Spieler, 1 gewertete Spiele, 1 Fragen/Einträge')
  })

  it('lehnt fremde Dateien ab', () => {
    expect(() => parseBackup('kein json')).toThrow('gültige Sicherung')
    expect(() => parseBackup('{"foo":1}')).toThrow('Sober-Games-Sicherung')
  })
})
