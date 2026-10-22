import { gameDef } from '../games/catalog'
import { newQuestion, type Question } from '../games/quiz/questionStore'
import { parseAnswer } from '../games/estimate/logic'
import { TERMS_PER_ROUND } from '../games/score/terms'

/** Bewertung einer Idee; leer heißt noch offen */
export type IdeaStatus = 'star' | 'maybe' | 'out'

export interface IdeaGame {
  id: string
  /** so viele Einträge braucht das Spiel am Abend */
  goal?: number
  /** Bezeichnung, wenn das Spiel selbst keine Fragenliste hat */
  label?: string
  /** die ⭐ werden in Runden dieser Größe gespielt und lassen sich drucken (Scribble Rush) */
  perRound?: number
}

/** Spiele in der Sammlung, in dieser Reihenfolge */
export const IDEA_GAMES: IdeaGame[] = [
  { id: 'wer-wuerde-eher', goal: 25 },
  { id: 'songs-erraten', goal: 35 },
  { id: 'guess-the-location', goal: 15 },
  { id: 'allgemeinwissen', goal: 40 },
  { id: 'schaetzfragen', goal: 30 },
  { id: 'scribble-rush', goal: 48, perRound: TERMS_PER_ROUND },
  { id: 'mein-team-kann' },
]

/** Die Ideen eines Spiels liegen in derselben Tabelle wie die Fragen, unter eigenem Schlüssel; kein Spiel liest sie. */
export const ideaKey = (gameId: string) => `ideen:${gameId}`

/** ob die ⭐-Ideen ins Spiel übernommen werden können (nur Spiele mit eigener Fragenliste) */
export const hasGameList = (gameId: string) => Boolean(gameDef(gameId).quiz)

/** der Text, unter dem man eine Idee wiedererkennt: die Frage oder bei Orten und Songs die Lösung */
export const ideaTitle = (q: Question) => q.question.trim() || q.answer.trim()

export const countStatus = (ideas: Question[], status: IdeaStatus | '') => ideas.filter((q) => (q.status ?? '') === status).length

/** Was noch fehlt, bevor eine Idee am Abend funktioniert */
export function ideaProblems(gameId: string, q: Question): string[] {
  const quiz = gameDef(gameId).quiz
  const problems: string[] = []
  if (quiz?.audio && !q.audioPath) problems.push('kein Song gewählt')
  if (quiz?.hints && q.hints.length === 0) problems.push('keine Hinweise')
  if (quiz && !quiz.noAnswer && !quiz.answerOnly && !q.answer.trim()) problems.push('keine Antwort')
  else if (quiz?.numeric && parseAnswer(q.answer, q.format) === null) problems.push(q.format === 'date' ? 'Datum ungültig' : q.format === 'year' ? 'Jahr ungültig' : 'Lösung ist keine Zahl')
  return problems
}

/** Kopie mit neuer ID (auch für die Hinweise), ohne Bewertung und Notiz */
export const copyEntry = (q: Question, patch: Partial<Question> = {}): Question =>
  newQuestion({
    question: q.question,
    answer: q.answer,
    info: q.info,
    imagePath: q.imagePath,
    hints: q.hints.map((h) => ({ ...h, id: crypto.randomUUID() })),
    audioPath: q.audioPath ?? null,
    audioStart: q.audioStart ?? 0,
    ...(q.format ? { format: q.format } : {}),
    ...(q.challenge ? { challenge: { ...q.challenge } } : {}),
    ...patch,
  })

const sameEntry = (a: Question, b: Question) => a.question.trim() === b.question.trim() && a.answer.trim() === b.answer.trim()

/**
 * Die Spielliste aus den ⭐-Ideen: gleiche Reihenfolge, neue IDs, ohne Bewertung und Notiz.
 * Aufgaben, die im Spiel schon eingestellt sind (Baustein, Liste, Bilder), behalten ihre Einstellungen.
 */
export const starredToGame = (ideas: Question[], game: Question[] = []): Question[] =>
  ideas
    .filter((q) => q.status === 'star')
    .map((q) => {
      const set = !q.challenge ? game.find((g) => g.challenge && sameEntry(g, q)) : undefined
      return copyEntry(set ? { ...q, challenge: set.challenge, hints: q.hints.length ? q.hints : set.hints } : q)
    })

/** Holt die Einträge einer Spielliste als ⭐ in die Sammlung; was dort schon steht, kommt nicht doppelt. */
export function gameToIdeas(ideas: Question[], game: Question[]): Question[] {
  const fresh = game.filter((g) => !ideas.some((q) => sameEntry(q, g))).map((g) => copyEntry(g, { status: 'star', note: '' }))
  return [...ideas, ...fresh]
}
