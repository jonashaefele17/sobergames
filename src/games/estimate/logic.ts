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
 * Wie die Lösung einer Schätzfrage aussieht. Intern ist alles eine Zahl: ein
 * Datum zählt die Tage seit dem 1.1.1970, damit Abstand und Wertung gleich bleiben.
 */
export type AnswerFormat = 'number' | 'year' | 'date'

export const ANSWER_FORMATS: [AnswerFormat, string][] = [
  ['number', 'Zahl'],
  ['year', 'Jahr'],
  ['date', 'Datum'],
]

const DAY_MS = 86_400_000
const pad2 = (n: number) => String(n).padStart(2, '0')

/** „9.11.1989“ → Tage seit 1970; null bei ungültigem Datum (auch 31.02.) */
export function parseDate(text: string): number | null {
  const m = /^(\d{1,2})\.(\d{1,2})\.(-?\d{1,4})$/.exec(text.trim())
  if (!m) return null
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(0)
  // setUTCFullYear statt Date.UTC: sonst werden die Jahre 0–99 zu 1900–1999
  d.setUTCFullYear(year, month - 1, day)
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  return Math.round(d.getTime() / DAY_MS)
}

export function formatDate(days: number): string {
  const d = new Date(Math.round(days) * DAY_MS)
  const year = d.getUTCFullYear()
  return `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}.${year < 0 ? '-' : ''}${String(Math.abs(year)).padStart(4, '0')}`
}

/** ganze Jahreszahl, vor Christus mit Minus */
export function parseYear(text: string): number | null {
  const t = text.trim()
  return /^-?\d{1,4}$/.test(t) ? Number(t) : null
}

export const formatYear = (year: number) => (year < 0 ? `${-year} v. Chr.` : String(year))

export function parseAnswer(text: string, format: AnswerFormat = 'number'): number | null {
  return format === 'date' ? parseDate(text) : format === 'year' ? parseYear(text) : parseNumber(text)
}

export function formatAnswer(value: number, format: AnswerFormat = 'number'): string {
  return format === 'date' ? formatDate(value) : format === 'year' ? formatYear(value) : formatNumber(value)
}

/** Abstand zur Lösung in Worten, z. B. „12 Jahre“ oder „400 Tage (≈ 1,1 Jahre)“ */
export function formatDistance(distance: number, format: AnswerFormat = 'number'): string {
  const d = Math.abs(distance)
  if (format === 'year') return `${formatNumber(d)} ${d === 1 ? 'Jahr' : 'Jahre'}`
  if (format !== 'date') return formatNumber(d)
  const days = `${formatNumber(d)} ${d === 1 ? 'Tag' : 'Tage'}`
  if (d < 365) return days
  const years = Math.round((d / 365.25) * 10) / 10
  return `${days} (≈ ${years.toLocaleString('de-DE')} ${years === 1 ? 'Jahr' : 'Jahre'})`
}

/** Ist eine eingefügte Lösung ein Datum? Dann wird die Frage gleich als Datum angelegt. */
export const detectFormat = (answer: string): AnswerFormat | undefined => (parseDate(answer) !== null ? 'date' : undefined)

/** Datumsmaske beim Tippen: „09111989“ → „09.11.1989“; ein getippter Punkt nach einer Ziffer füllt mit 0 auf („9.“ → „09“). */
export function maskDate(raw: string): string {
  const parts = raw.split('.')
  const digits = parts
    .map((p, i) => {
      const d = p.replace(/\D/g, '')
      return i < parts.length - 1 && i < 2 && d.length === 1 ? `0${d}` : d
    })
    .join('')
    .slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('.')
}

/** Jahreszahl beim Tippen: nur Ziffern, höchstens vier, ein Minus am Anfang für v. Chr. */
export const maskYear = (raw: string) => (raw.trim().startsWith('-') ? '-' : '') + raw.replace(/\D/g, '').slice(0, 4)

/**
 * Setzt beim Tippen Tausenderpunkte: „84000000“ → „84.000.000“, „1250,5“ →
 * „1.250,5“. Alles außer Ziffern, dem ersten Komma und einem Minus am Anfang
 * fällt weg; ein Komma am Ende bleibt stehen, damit man weitertippen kann.
 */
export function groupDigits(text: string): string {
  const sign = text.trim().startsWith('-') ? '-' : ''
  const clean = text.replace(/[^\d,]/g, '')
  const comma = clean.indexOf(',')
  const whole = (comma < 0 ? clean : clean.slice(0, comma)).replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+$)/g, '.')
  return comma < 0 ? sign + whole : `${sign}${whole || '0'},${clean.slice(comma + 1).replace(/,/g, '')}`
}

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
