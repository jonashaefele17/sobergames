import { describe, expect, it } from 'vitest'
import { gameDef } from '../games/catalog'
import { newQuestion } from '../games/quiz/questionStore'
import { hideTerms, showTerms, termRounds, termsView } from '../games/score/terms'
import * as act from '../lib/actions'
import { describeQuestionExport, parseQuestionExport } from '../lib/backup'
import { gameToIdeas, IDEA_GAMES, ideaKey, ideaProblems, starredToGame } from './ideas'

describe('Sammlung', () => {
  it('nur ⭐ kommen ins Spiel, in ihrer Reihenfolge, mit neuen IDs und ohne Bewertung', () => {
    const ideas = [
      newQuestion({ question: 'A', status: 'star', note: 'Quelle' }),
      newQuestion({ question: 'B', status: 'maybe' }),
      newQuestion({ question: 'C' }),
      newQuestion({ question: 'D', status: 'star', hints: [{ id: 'h1', kind: 'text', value: 'Fluss' }] }),
    ]
    const game = starredToGame(ideas)
    expect(game.map((q) => q.question)).toEqual(['A', 'D'])
    expect(game[0].id).not.toBe(ideas[0].id)
    expect(game[1].hints[0]).toMatchObject({ kind: 'text', value: 'Fluss' })
    expect(game[1].hints[0].id).not.toBe('h1')
    expect(game[0]).not.toHaveProperty('status')
    expect(game[0]).not.toHaveProperty('note')
  })

  it('Übernehmen behält die im Spiel eingestellten Aufgaben (Baustein, Liste)', () => {
    const ideas = [newQuestion({ question: 'WM-Kader 2014', status: 'star' }), newQuestion({ question: 'Neu', status: 'star' })]
    const game = [newQuestion({ question: 'WM-Kader 2014', challenge: { type: 'list' }, hints: [{ id: 'h', kind: 'text', value: 'Neuer' }] })]
    const next = starredToGame(ideas, game)
    expect(next[0].challenge).toEqual({ type: 'list' })
    expect(next[0].hints.map((h) => h.value)).toEqual(['Neuer'])
    expect(next[0].hints[0].id).not.toBe('h')
    expect(next[1].challenge).toBeUndefined()
  })

  it('Spielfragen holen: als ⭐ hinten an, ohne Doppelte', () => {
    const ideas = [newQuestion({ question: 'A', answer: '1', status: 'maybe' })]
    const merged = gameToIdeas(ideas, [newQuestion({ question: 'A', answer: '1' }), newQuestion({ question: 'B', answer: '2' })])
    expect(merged.map((q) => [q.question, q.status])).toEqual([
      ['A', 'maybe'],
      ['B', 'star'],
    ])
  })

  it('meldet, was für den Abend noch fehlt', () => {
    expect(ideaProblems('songs-erraten', newQuestion({ answer: 'Song' }))).toEqual(['kein Song gewählt'])
    expect(ideaProblems('guess-the-location', newQuestion({ answer: 'Köln' }))).toEqual(['keine Hinweise'])
    expect(ideaProblems('allgemeinwissen', newQuestion({ question: 'Frage?' }))).toEqual(['keine Antwort'])
    expect(ideaProblems('wer-wuerde-eher', newQuestion({ question: '… zuerst einschlafen?' }))).toEqual([])
  })

  it('eigener Schlüssel, den kein Spiel liest', () => {
    expect(ideaKey('allgemeinwissen')).toBe('ideen:allgemeinwissen')
  })
})

describe('Begriffe (Scribble Rush)', () => {
  const terms = Array.from({ length: 28 }, (_, i) => `Begriff ${i + 1}`)

  it('je 12 Begriffe eine Runde, der Rest bildet die letzte', () => {
    const rounds = termRounds(terms)
    expect(rounds.map((r) => r.length)).toEqual([12, 12, 4])
    expect(rounds[1][0]).toBe('Begriff 13')
    expect(termRounds([])).toEqual([])
  })

  it('auf den Beamer kommen nur die aufgedeckten Begriffe', () => {
    const round2 = termRounds(terms)[1]
    let s = act.startPlay('scribble-rush')(act.initialState())
    expect(termsView(s)).toBeNull()
    s = showTerms(1, round2, 0)(s)
    expect(termsView(s)).toEqual({ round: 1, total: 12, shown: [] })
    s = showTerms(1, round2, 2)(s)
    expect(termsView(s)?.shown).toEqual(['Begriff 13', 'Begriff 14'])
    expect(JSON.stringify(s)).not.toContain('Begriff 15')
    s = showTerms(1, round2, 99)(s)
    expect(termsView(s)?.shown).toHaveLength(12)
    expect(termsView(hideTerms(s))).toBeNull()
  })

  it('Scribble Rush hat eine Begriffsliste und bleibt eine Punktetafel', () => {
    expect(gameDef('scribble-rush')).toMatchObject({ kind: 'score', quiz: { itemLabel: 'Begriff', noAnswer: true } })
    expect(IDEA_GAMES.find((g) => g.id === 'scribble-rush')).toMatchObject({ goal: 48, perRound: 12 })
  })
})

describe('Fragen-Datei', () => {
  const file = {
    version: 1,
    kind: 'fragen',
    createdAt: '2026-10-20T18:00:00.000Z',
    content: { allgemeinwissen: [{ id: 'x', question: 'Hauptstadt?', answer: 'Paris', info: '', hints: [] }], unbekannt: [{ question: 'weg' }] },
    ideas: {
      allgemeinwissen: [
        { id: 'y', question: 'Idee', answer: '', status: 'star', note: 'n' },
        { question: '', answer: '' },
        { question: 'Kaputter Status', status: 'super' },
      ],
      'mein-team-kann': [{ question: '15 Automarken' }],
    },
  }

  it('liest Spiellisten und Sammlung, verwirft Unbekanntes und Leeres, vergibt neue IDs', () => {
    const read = parseQuestionExport(JSON.stringify(file))
    expect(Object.keys(read.content)).toEqual(['allgemeinwissen'])
    expect(read.content.allgemeinwissen[0]).toMatchObject({ question: 'Hauptstadt?', answer: 'Paris' })
    expect(read.content.allgemeinwissen[0].id).not.toBe('x')
    expect(read.content.allgemeinwissen[0]).not.toHaveProperty('status')
    expect(read.ideas.allgemeinwissen.map((q) => [q.question, q.status, q.note])).toEqual([
      ['Idee', 'star', 'n'],
      ['Kaputter Status', undefined, ''],
    ])
    expect(read.ideas['mein-team-kann']).toHaveLength(1)
    expect(describeQuestionExport(read)).toContain('Allgemeinwissen: 1 im Spiel, 2 in der Sammlung')
    expect(describeQuestionExport(read)).toContain('Mein Team kann: 1 in der Sammlung')
    expect(describeQuestionExport(parseQuestionExport('{"version":1,"content":{"schaetzfragen":[]}}'))).toContain('Leer (wird geleert): Schätzfragen')
  })

  it('Aufgaben von Mein Team kann behalten Baustein und Liste', () => {
    const read = parseQuestionExport(
      JSON.stringify({
        version: 1,
        content: {
          'mein-team-kann': [
            { question: 'Länder', challenge: { type: 'list' }, hints: [{ kind: 'text', value: 'Ghana' }] },
            { question: 'Ja-Nein', challenge: { type: 'time', timers: 3.2 } },
            { question: 'Kaputt', challenge: { type: 'quatsch' } },
          ],
        },
      }),
    )
    expect(read.content['mein-team-kann'].map((q) => q.challenge)).toEqual([{ type: 'list' }, { type: 'time', timers: 3 }, undefined])
    expect(read.content['mein-team-kann'][0].hints[0]).toMatchObject({ kind: 'text', value: 'Ghana' })
    expect(read.ideas).toEqual({})
  })

  it('nimmt von einer kompletten Sicherung nur die Fragen', () => {
    const backup = {
      version: 1,
      createdAt: '',
      state: { players: [{ id: 'p', name: 'Jonas' }] },
      content: { schaetzfragen: [{ question: 'Wie hoch?', answer: '157', info: 'm' }, { question: 'Mauerfall?', answer: '09.11.1989', format: 'date' }, { question: 'X', answer: '1', format: 'quatsch' }] },
    }
    const read = parseQuestionExport(JSON.stringify(backup))
    expect(read).not.toHaveProperty('state')
    expect(read.content.schaetzfragen[0]).toMatchObject({ question: 'Wie hoch?', answer: '157', info: 'm' })
    expect(read.content.schaetzfragen.map((q) => q.format)).toEqual([undefined, 'date', undefined])
    expect(read.ideas).toEqual({})
  })

  it('lehnt fremde Dateien ab', () => {
    expect(() => parseQuestionExport('kein json')).toThrow('gültige Fragen-Datei')
    expect(() => parseQuestionExport('{"version":2,"content":{}}')).toThrow('Sober-Games-Fragen-Datei')
    expect(() => parseQuestionExport('null')).toThrow('Sober-Games-Fragen-Datei')
  })
})
