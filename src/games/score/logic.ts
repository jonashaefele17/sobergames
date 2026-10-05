import type { ScoreData, State } from '../../store/types'
import { gameDef } from '../catalog'

const uid = () => Math.random().toString(36).slice(2, 10)

/** Punktetafel des laufenden Spiels; Zielpunktzahl und Zahl der Versuche kommen anfangs aus dem Katalog. */
export function scoreData(state: State): ScoreData {
  const config = state.play.gameId ? gameDef(state.play.gameId).score : undefined
  return state.play.data.score ?? { rounds: [], target: config?.target ?? null, shots: {}, shotCount: config?.shots ?? 6 }
}

/** Versuche eines Teams, aufgefüllt auf die eingestellte Anzahl */
export function teamShots(data: ScoreData, teamId: string): (number | null)[] {
  const shots = data.shots?.[teamId] ?? []
  return Array.from({ length: data.shotCount ?? 0 }, (_, i) => shots[i] ?? null)
}

/** Punkte je Team aus Runden und Versuchen */
export function totals(data: ScoreData, teamIds: string[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(teamIds.map((id) => [id, 0]))
  for (const r of data.rounds) {
    for (const [id, p] of Object.entries(r.points)) {
      if (id in out) out[id] += p
    }
  }
  for (const id of teamIds) {
    out[id] += teamShots(data, id).reduce<number>((sum, p) => sum + (p ?? 0), 0)
  }
  return out
}

/** Hat das Spiel schon einen Eintrag? Bis dahin zeigt der Beamer die Titelseite. */
export function hasEntries(data: ScoreData): boolean {
  return data.rounds.length > 0 || Object.values(data.shots ?? {}).some((s) => s.some((p) => p !== null))
}

/** Teams, die die Zielpunktzahl erreicht haben */
export function reached(data: ScoreData, teamIds: string[]): string[] {
  if (!data.target) return []
  const t = totals(data, teamIds)
  return teamIds.filter((id) => t[id] >= data.target!)
}

const withScore = (s: State, fn: (d: ScoreData) => ScoreData): State => ({
  ...s,
  play: { ...s.play, data: { ...s.play.data, score: fn(scoreData(s)) } },
})

/** Bucht eine Runde; Teams ohne Eintrag bekommen 0. Leere Buchungen werden ignoriert. */
export const addRound = (points: Record<string, number>) => (s: State): State => {
  const clean = Object.fromEntries(Object.entries(points).filter(([, p]) => Number.isFinite(p) && p !== 0))
  if (Object.keys(clean).length === 0) return s
  return withScore(s, (d) => ({ ...d, rounds: [...d.rounds, { id: uid(), points: clean }] }))
}

export const removeRound = (id: string) => (s: State): State =>
  withScore(s, (d) => ({ ...d, rounds: d.rounds.filter((r) => r.id !== id) }))

export const undoRound = (s: State): State => withScore(s, (d) => ({ ...d, rounds: d.rounds.slice(0, -1) }))

export const setTarget = (target: number | null) => (s: State): State =>
  withScore(s, (d) => ({ ...d, target: target && target > 0 ? target : null }))

/** Trägt einen einzelnen Versuch ein (0-basiert) oder leert ihn mit null. */
export const setShot = (teamId: string, index: number, value: number | null) => (s: State): State =>
  withScore(s, (d) => {
    if (index < 0 || index >= (d.shotCount ?? 0)) return d
    const shots = teamShots(d, teamId)
    shots[index] = value
    return { ...d, shots: { ...d.shots, [teamId]: shots } }
  })

/** Ändert die Zahl der Versuche je Team; überzählige Einträge fallen weg. */
export const setShotCount = (count: number) => (s: State): State =>
  withScore(s, (d) => {
    const shotCount = Math.max(1, Math.min(20, Math.round(count) || 1))
    const shots = Object.fromEntries(Object.entries(d.shots ?? {}).map(([id, list]) => [id, list.slice(0, shotCount)]))
    return { ...d, shots, shotCount }
  })
