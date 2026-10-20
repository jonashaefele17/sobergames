import { describe, expect, it } from 'vitest'
import { newQuestion } from '../games/quiz/questionStore'
import { describeQuestionExport, parseQuestionExport } from '../lib/backup'
import { gameToIdeas, ideaKey, ideaProblems, starredToGame } from './ideas'

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

  it('nimmt von einer kompletten Sicherung nur die Fragen', () => {
    const backup = { version: 1, createdAt: '', state: { players: [{ id: 'p', name: 'Jonas' }] }, content: { schaetzfragen: [{ question: 'Wie hoch?', answer: '157', info: 'm' }] } }
    const read = parseQuestionExport(JSON.stringify(backup))
    expect(read).not.toHaveProperty('state')
    expect(read.content.schaetzfragen[0]).toMatchObject({ question: 'Wie hoch?', answer: '157', info: 'm' })
    expect(read.ideas).toEqual({})
  })

  it('lehnt fremde Dateien ab', () => {
    expect(() => parseQuestionExport('kein json')).toThrow('gültige Fragen-Datei')
    expect(() => parseQuestionExport('{"version":2,"content":{}}')).toThrow('Sober-Games-Fragen-Datei')
    expect(() => parseQuestionExport('null')).toThrow('Sober-Games-Fragen-Datei')
  })
})
