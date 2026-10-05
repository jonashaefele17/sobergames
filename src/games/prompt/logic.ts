import type { State } from '../../store/types'

/** Teams, die bei Frage `index` den Punkt bekommen */
export const awarded = (state: State, index: number): string[] => state.play.data.awards?.[index] ?? []

/** Schaltet den Punkt eines Teams für eine Frage um. */
export const toggleAward = (index: number, teamId: string) => (s: State): State => {
  const current = awarded(s, index)
  const next = current.includes(teamId) ? current.filter((id) => id !== teamId) : [...current, teamId]
  return { ...s, play: { ...s.play, data: { ...s.play.data, awards: { ...s.play.data.awards, [index]: next } } } }
}

/** Punkte je Team: ein Punkt pro Frage, in der das Team ausgewählt ist */
export function awardTotals(state: State): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(state.teams.map((t) => [t.id, 0]))
  for (const ids of Object.values(state.play.data.awards ?? {})) {
    for (const id of ids) {
      if (id in out) out[id] += 1
    }
  }
  return out
}
