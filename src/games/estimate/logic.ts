import type { EstimateData, EstimateMode, State } from '../../store/types'

/** Korrekturen von Hand liegen unter diesem Schlüssel neben den Punkten je Frage */
const MANUAL = 'manual'

export const estimateData = (state: State): EstimateData =>
  state.play.data.estimate ?? { mode: 'nearest', submitted: [], guesses: {}, solution: null, points: {} }

/**
 * Liest eine Zahl in deutscher oder englischer Schreibweise: „1.250“, „3,5“,
 * „1.250,75“, „1250.5“. Gibt null zurück, wenn es keine Zahl ist.
 */
export function parseNumber(text: string): number | null {
  let t = text.trim().replace(/\s/g, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export const formatNumber = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 6 })

/**
 * Punkte für eine Frage. `nearest`: 1 Punkt für die kleinste Abweichung.
 * `graded`: 2 für die kleinste, 1 für die zweitkleinste. Gleicher Abstand
 * heißt gleiche Punkte; Teams ohne Schätzung bekommen nichts.
 */
export function award(guesses: Record<string, number>, solution: number, mode: EstimateMode): Record<string, number> {
  const distance = Object.entries(guesses).map(([teamId, g]) => ({ teamId, d: Math.abs(g - solution) }))
  const steps = [...new Set(distance.map((x) => x.d))].sort((a, b) => a - b)
  const scale = mode === 'graded' ? [2, 1] : [1]
  const out: Record<string, number> = {}
  for (const { teamId, d } of distance) {
    const points = scale[steps.indexOf(d)] ?? 0
    if (points > 0) out[teamId] = points
  }
  return out
}

export function estimateTotals(state: State): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(state.teams.map((t) => [t.id, 0]))
  for (const perTeam of Object.values(estimateData(state).points)) {
    for (const [id, p] of Object.entries(perTeam)) {
      if (id in out) out[id] += p
    }
  }
  return out
}

const withData = (s: State, fn: (d: EstimateData) => EstimateData): State => ({
  ...s,
  play: { ...s.play, data: { ...s.play.data, estimate: fn(estimateData(s)) } },
})

/** neue Frage: Abgaben, aufgedeckte Schätzungen und Lösung beginnen leer */
export const resetQuestion = (s: State): State => withData(s, (d) => ({ ...d, submitted: [], guesses: {}, solution: null }))

/** welche Teams abgegeben haben (ohne Zahl) – nur schreiben, wenn sich etwas geändert hat */
export const setSubmitted = (teamIds: string[]) => (s: State): State => {
  const next = [...teamIds].sort()
  return next.join() === [...estimateData(s).submitted].sort().join() ? s : withData(s, (d) => ({ ...d, submitted: next }))
}

/** deckt die Schätzung eines einzelnen Teams auf */
export const revealGuess = (teamId: string, value: number) => (s: State): State =>
  withData(s, (d) => ({ ...d, guesses: { ...d.guesses, [teamId]: value } }))

/** deckt die Lösung auf, zeigt dabei alle Schätzungen und vergibt die Punkte der Frage */
export const revealSolution = (index: number, solution: number, guesses: Record<string, number>) => (s: State): State =>
  withData(s, (d) => ({ ...d, guesses, solution, points: { ...d.points, [index]: award(guesses, solution, d.mode) } }))

/** schaltet die Wertung um; ist die Lösung der laufenden Frage schon aufgedeckt, wird sie neu gewertet */
export const setMode = (mode: EstimateMode, index: number) => (s: State): State =>
  withData(s, (d) => ({
    ...d,
    mode,
    points: d.solution !== null && index >= 0 ? { ...d.points, [index]: award(d.guesses, d.solution, mode) } : d.points,
  }))

export const adjustPoints = (teamId: string, delta: number) => (s: State): State =>
  withData(s, (d) => {
    const manual = d.points[MANUAL] ?? {}
    return { ...d, points: { ...d.points, [MANUAL]: { ...manual, [teamId]: (manual[teamId] ?? 0) + delta } } }
  })
