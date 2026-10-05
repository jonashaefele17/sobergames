import type { Game } from '../store/types'

/** Spielart: bestimmt, welche Steuerung, Beamer-Szene und Daten ein Spiel hat (siehe registry.tsx). */
export type GameKind = 'plain' | 'quiz' | 'score' | 'countdown' | 'stopwatch' | 'prompt' | 'measure'

export interface GameVariant {
  key: string
  name: string
  note?: string
  /** abweichende Spielart, z. B. ohne eigene Spielseite */
  kind?: GameKind
}

/**
 * Punktetafel:
 * - winner: pro Runde gewinnt ein Team (+1)
 * - steps: Knöpfe mit festen Punktwerten je Team
 * - round: pro Runde eine Zahl je Team (0 … max)
 * - free: pro Runde beliebige Punkte je Team, auch Abzug
 * - shots: jedes Team hat eine feste Zahl Versuche, jeder wird einzeln mit einem Punktwert eingetragen
 */
export interface ScoreConfig {
  mode: 'winner' | 'steps' | 'round' | 'free' | 'shots'
  /** wählbare Punktwerte (steps, shots) */
  steps?: number[]
  max?: number
  /** Versuche je Team (shots), im Regiepult änderbar */
  shots?: number
  /** voreingestellte Zielpunktzahl, im Regiepult änderbar */
  target?: number
}

export interface QuizConfig {
  /** Bezeichnung eines Eintrags im Editor und im Regiepult */
  itemLabel: string
  /** Bild füllt die Fläche, Text steht darunter (z. B. Orte) */
  imageFirst?: boolean
  /** Einträge ohne Antwort, z. B. Aussagen bei „Wer würde eher“ */
  noAnswer?: boolean
  /** reine Namensliste: ohne Bilder und ohne Beispielfragen, z. B. die Objekte bei Perfect Cut */
  plainList?: boolean
}

export interface GameDef {
  /** fester Schlüssel; daran hängen Ergebnis und eigene Daten, egal an welchem Platz das Spiel steht */
  id: string
  name: string
  category: string
  kind: GameKind
  variants?: GameVariant[]
  quiz?: QuizConfig
  score?: ScoreConfig
  /** Voreinstellung des Timers in Minuten (Countdown auf dem Beamer bzw. Orientierung im Regiepult) */
  timerMinutes?: number
  /** Einheit eingetragener Messwerte, z. B. cm */
  unit?: string
}

/** Die Spiele des Abends in der geplanten Reihenfolge; die Reihenfolge lässt sich im Regiepult ändern. */
export const GAMES: GameDef[] = [
  {
    id: 'last-cup-standing',
    name: 'Last Cup Standing',
    category: 'Geschicklichkeit',
    kind: 'score',
    score: { mode: 'winner', target: 5 },
  },
  {
    id: 'arschbolzen',
    name: 'Arschbolzen',
    category: 'Geschicklichkeit',
    kind: 'score',
    // je Schuss wählt das Team die Distanz: nah 1, mittel 2, weit 3 Punkte; daneben 0
    score: { mode: 'shots', shots: 6, steps: [0, 1, 2, 3] },
    variants: [
      { key: 'arschbolzen', name: 'Arschbolzen' },
      // Kippmoment wird vor Ort gewertet: nur der Sieger wird im Spiele-Tab eingetragen
      { key: 'kippmoment', name: 'Kippmoment', note: 'bei schlechtem Wetter', kind: 'plain' },
    ],
  },
  { id: 'ex-oder-zieh', name: 'Ex oder zieh', category: 'Party', kind: 'stopwatch' },
  { id: 'wer-wuerde-eher', name: 'Wer würde eher', category: 'Soziales', kind: 'prompt', quiz: { itemLabel: 'Frage', noAnswer: true } },
  { id: 'songs-erraten', name: 'Songs erraten', category: 'Musik', kind: 'quiz', quiz: { itemLabel: 'Song' }, timerMinutes: 25 },
  {
    id: 'build-it',
    name: 'Build it',
    category: 'Geschicklichkeit',
    kind: 'countdown',
    timerMinutes: 5,
    unit: 'cm',
  },
  {
    id: 'guess-the-location',
    name: 'Guess the Location',
    category: 'Wissen',
    kind: 'quiz',
    quiz: { itemLabel: 'Ort', imageFirst: true },
    timerMinutes: 25,
  },
  {
    id: 'scribble-rush',
    name: 'Scribble Rush',
    category: 'Kreativität',
    kind: 'score',
    score: { mode: 'round', max: 12 },
  },
  { id: 'allgemeinwissen', name: 'Allgemeinwissen', category: 'Wissen', kind: 'quiz', quiz: { itemLabel: 'Frage' }, timerMinutes: 25 },
  {
    id: 'perfect-cut',
    name: 'Perfect Cut',
    category: 'Geschicklichkeit',
    kind: 'measure',
    unit: 'g',
    quiz: { itemLabel: 'Objekt', noAnswer: true, plainList: true },
  },
  { id: 'schaetzfragen', name: 'Schätzfragen', category: 'Wissen', kind: 'plain' },
  {
    id: 'closest-to-the-edge',
    name: 'Closest to the Edge',
    category: 'Geschicklichkeit',
    kind: 'score',
    score: { mode: 'winner' },
  },
  {
    id: 'mein-team-kann',
    name: 'Mein Team kann',
    category: 'Allgemeines',
    kind: 'score',
    score: { mode: 'free' },
  },
]

const BY_ID = new Map(GAMES.map((d) => [d.id, d]))

export function gameDef(id: string): GameDef {
  return BY_ID.get(id) ?? { id, name: id, category: '', kind: 'plain' }
}

export const isKnownGame = (id: string) => BY_ID.has(id)

/** Gewählte Variante oder die erste */
export function gameVariant(game: Pick<Game, 'id' | 'variant'>): GameVariant | null {
  const variants = gameDef(game.id).variants
  if (!variants) return null
  return variants.find((v) => v.key === game.variant) ?? variants[0]
}

/** Anzeigename inklusive gewählter Variante */
export function gameName(game: Pick<Game, 'id' | 'variant'>): string {
  return gameVariant(game)?.name ?? gameDef(game.id).name
}

/** geltende Spielart: die gewählte Variante kann sie überschreiben */
export function gameKind(game: Pick<Game, 'id' | 'variant'>): GameKind {
  return gameVariant(game)?.kind ?? gameDef(game.id).kind
}
