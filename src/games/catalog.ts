import type { Game } from '../store/types'

/** Spielart: bestimmt, welche Steuerung, Beamer-Szene und Daten ein Spiel hat (siehe registry.tsx). */
export type GameKind = 'plain' | 'quiz'

export interface GameVariant {
  key: string
  name: string
  note?: string
}

export interface QuizConfig {
  /** Bezeichnung eines Eintrags im Editor und im Regiepult */
  itemLabel: string
  /** Bild füllt die Fläche, Text steht darunter (z. B. Orte) */
  imageFirst?: boolean
}

export interface GameDef {
  /** fester Schlüssel; daran hängen Ergebnis und eigene Daten, egal an welchem Platz das Spiel steht */
  id: string
  name: string
  category: string
  kind: GameKind
  variants?: GameVariant[]
  quiz?: QuizConfig
}

/** Die Spiele des Abends in der geplanten Reihenfolge; die Reihenfolge lässt sich im Regiepult ändern. */
export const GAMES: GameDef[] = [
  { id: 'last-cup-standing', name: 'Last Cup Standing', category: 'Geschicklichkeit', kind: 'plain' },
  {
    id: 'arschbolzen',
    name: 'Arschbolzen',
    category: 'Geschicklichkeit',
    kind: 'plain',
    variants: [
      { key: 'arschbolzen', name: 'Arschbolzen' },
      { key: 'kippmoment', name: 'Kippmoment', note: 'bei schlechtem Wetter' },
    ],
  },
  { id: 'ex-oder-zieh', name: 'Ex oder zieh', category: 'Party', kind: 'plain' },
  { id: 'wer-wuerde-eher', name: 'Wer würde eher', category: 'Soziales', kind: 'plain' },
  { id: 'songs-erraten', name: 'Songs erraten', category: 'Musik', kind: 'quiz', quiz: { itemLabel: 'Song' } },
  { id: 'build-it', name: 'Build it', category: 'Geschicklichkeit', kind: 'plain' },
  {
    id: 'guess-the-location',
    name: 'Guess the Location',
    category: 'Wissen',
    kind: 'quiz',
    quiz: { itemLabel: 'Ort', imageFirst: true },
  },
  { id: 'scribble-rush', name: 'Scribble Rush', category: 'Kreativität', kind: 'plain' },
  { id: 'allgemeinwissen', name: 'Allgemeinwissen', category: 'Wissen', kind: 'quiz', quiz: { itemLabel: 'Frage' } },
  { id: 'perfect-cut', name: 'Perfect Cut', category: 'Geschicklichkeit', kind: 'plain' },
  { id: 'schaetzfragen', name: 'Schätzfragen', category: 'Wissen', kind: 'plain' },
  { id: 'closest-to-the-edge', name: 'Closest to the Edge', category: 'Geschicklichkeit', kind: 'plain' },
  { id: 'mein-team-kann', name: 'Mein Team kann', category: 'Allgemeines', kind: 'plain' },
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
