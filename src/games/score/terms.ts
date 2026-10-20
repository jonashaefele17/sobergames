import type { State, TermsView } from '../../store/types'

/** so viele Kästchen hat ein Zeichenblatt */
export const TERMS_PER_ROUND = 12

/** Teilt die Begriffe in Runden: 1–12 ist Runde 1, 13–24 Runde 2 … */
export function termRounds<T>(terms: T[]): T[][] {
  const rounds: T[][] = []
  for (let i = 0; i < terms.length; i += TERMS_PER_ROUND) rounds.push(terms.slice(i, i + TERMS_PER_ROUND))
  return rounds
}

export const termsView = (s: State): TermsView | null => s.play.data.terms ?? null

const withTerms = (s: State, terms: TermsView | null): State => ({ ...s, play: { ...s.play, data: { ...s.play.data, terms } } })

/** Zeigt das Raster einer Runde mit den ersten `count` Begriffen; der Beamer bekommt nur diese. */
export const showTerms = (round: number, terms: string[], count: number) => (s: State): State =>
  withTerms(s, { round, total: terms.length, shown: terms.slice(0, Math.max(0, Math.min(count, terms.length))) })

/** zurück zur Punktetafel */
export const hideTerms = (s: State): State => withTerms(s, null)
