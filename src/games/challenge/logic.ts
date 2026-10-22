import type { ChallengeConfig, ChallengeData, ChallengeRun, ChallengeType, State, Team } from '../../store/types'

/** Korrekturen von Hand liegen unter diesem Schlüssel neben den Punkten je Aufgabe */
const MANUAL = 'manual'

/** Punkte: geschafft bekommt das spielende Team so viele, sonst jedes andere Team */
export const WIN_POINTS = 2
export const LOSE_POINTS = 1

export const CHALLENGE_TYPES: [ChallengeType, string][] = [
  ['count', 'Zählen'],
  ['list', 'Aufzählen mit Liste'],
  ['free', 'Aufzählen frei'],
  ['time', 'Zeit'],
]

export const typeLabel = (type: ChallengeType) => CHALLENGE_TYPES.find(([key]) => key === type)?.[1] ?? type

export const challengeData = (state: State): ChallengeData => state.play.data.challenge ?? { current: null, points: {}, results: {} }

const withData = (s: State, fn: (d: ChallengeData) => ChallengeData): State => ({
  ...s,
  play: { ...s.play, data: { ...s.play.data, challenge: fn(challengeData(s)) } },
})

const withRun = (s: State, fn: (r: ChallengeRun) => ChallengeRun): State =>
  challengeData(s).current ? withData(s, (d) => ({ ...d, current: fn(d.current!) })) : s

/** Runden beim Zählen: Spieler im Team − 1, ohne eingeteilte Spieler 3 */
export const defaultRounds = (team: Team | undefined) => (team && team.playerIds.length > 1 ? team.playerIds.length - 1 : 3)

/** Startet eine Aufgabe; eine laufende wird dabei ersetzt, ihre Wertung bleibt. */
export const startChallenge = (index: number, total: number, title: string, config: ChallengeConfig) => (s: State): State =>
  withData(s, (d) => ({
    ...d,
    current: {
      index,
      total,
      type: config.type,
      title,
      teamId: null,
      target: null,
      targetShown: false,
      counts: [],
      timers: Array.from({ length: Math.max(1, config.timers ?? 1) }, () => ({ ms: 0, startedAt: null })),
      named: [],
      revealed: [],
      live: false,
      missed: null,
      image: null,
      verdict: null,
    },
  }))

/** zurück zur Übersicht */
export const closeChallenge = (s: State): State => withData(s, (d) => ({ ...d, current: null }))

/** Wählt das spielende Team; beim Zählen richtet sich die Rundenzahl nach dem Team, Eingetragenes bleibt. */
export const setTeam = (teamId: string) => (s: State): State =>
  withRun(s, (r) => {
    const rounds = defaultRounds(s.teams.find((t) => t.id === teamId))
    return { ...r, teamId, counts: r.type === 'count' ? resize(r.counts, rounds) : r.counts }
  })

const resize = (counts: (number | null)[], n: number) => Array.from({ length: Math.max(1, n) }, (_, i) => counts[i] ?? null)

export const setRounds = (n: number) => (s: State): State => withRun(s, (r) => ({ ...r, counts: resize(r.counts, Math.min(12, n)) }))

export const setTarget = (target: number | null) => (s: State): State => withRun(s, (r) => ({ ...r, target }))

export const showTarget = (shown: boolean) => (s: State): State => withRun(s, (r) => ({ ...r, targetShown: shown }))

export const setCount = (round: number, value: number | null) => (s: State): State =>
  withRun(s, (r) => ({ ...r, counts: r.counts.map((c, i) => (i === round ? value : c)) }))

/** Zielzeit lesbar: „45 s“ bzw. „2:00“ (ganze Sekunden) */
export function formatTarget(ms: number): string {
  const total = Math.round(ms / 1000)
  return total < 60 ? `${total} s` : `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Zeit eines Timers bis jetzt */
export const timerMs = (t: ChallengeRun['timers'][number], now: number) => t.ms + (t.startedAt !== null ? Math.max(0, now - t.startedAt) : 0)

/** Startet einen Timer; solange einer läuft, startet kein zweiter. Ein gestoppter läuft weiter, wo er stand. */
export const startTimer = (i: number, now: number) => (s: State): State =>
  withRun(s, (r) => (r.timers.some((t) => t.startedAt !== null) ? r : { ...r, timers: r.timers.map((t, j) => (j === i ? { ...t, startedAt: now } : t)) }))

export const stopTimer = (now: number) => (s: State): State =>
  withRun(s, (r) => ({ ...r, timers: r.timers.map((t) => (t.startedAt !== null ? { ms: timerMs(t, now), startedAt: null } : t)) }))

/** Zeit von Hand setzen, 0 setzt zurück */
export const setTimer = (i: number, ms: number) => (s: State): State =>
  withRun(s, (r) => ({ ...r, timers: r.timers.map((t, j) => (j === i ? { ms: Math.max(0, ms), startedAt: null } : t)) }))

const same = (a: string, b: string) => a.trim().toLocaleLowerCase('de') === b.trim().toLocaleLowerCase('de')

/** list: abhaken bzw. wieder entfernen */
export const toggleNamed = (name: string) => (s: State): State =>
  withRun(s, (r) =>
    r.named.includes(name)
      ? { ...r, named: r.named.filter((n) => n !== name), revealed: r.revealed.filter((n) => n !== name) }
      : { ...r, named: [...r.named, name] },
  )

/** free: Genanntes hinzufügen; doppelt (ohne Groß-/Kleinschreibung) kommt es nicht dazu */
export const addNamed = (text: string) => (s: State): State =>
  withRun(s, (r) => {
    const name = text.trim()
    return !name || r.named.some((n) => same(n, name)) ? r : { ...r, named: [...r.named, name] }
  })

export const removeNamed = (name: string) => (s: State): State =>
  withRun(s, (r) => ({ ...r, named: r.named.filter((n) => n !== name), revealed: r.revealed.filter((n) => n !== name) }))

export const reveal = (name: string) => (s: State): State =>
  withRun(s, (r) => (r.revealed.includes(name) || !r.named.includes(name) ? r : { ...r, revealed: [...r.revealed, name] }))

export const revealAll = (s: State): State => withRun(s, (r) => ({ ...r, revealed: [...r.named] }))

export const setLive = (live: boolean) => (s: State): State => withRun(s, (r) => ({ ...r, live }))

/** list: zeigt zum Schluss, was nicht genannt wurde; null blendet es wieder aus */
export const showMissed = (all: string[] | null) => (s: State): State =>
  withRun(s, (r) => ({ ...r, missed: all ? all.filter((n) => !r.named.includes(n)) : null }))

export const setImage = (url: string | null) => (s: State): State => withRun(s, (r) => ({ ...r, image: url }))

/** Was auf dem Beamer von der Liste steht */
export const visibleNames = (r: ChallengeRun) => (r.type === 'list' && !r.live ? r.revealed : r.named)

/** Stand gegenüber dem Ziel: Summe der Runden, Anzahl Genanntes bzw. Zeit in ms */
export function progress(r: ChallengeRun, now: number): number {
  if (r.type === 'count') return r.counts.reduce<number>((sum, c) => sum + (c ?? 0), 0)
  if (r.type === 'time') return r.timers.reduce((sum, t) => sum + timerMs(t, now), 0)
  return r.named.length
}

/** Vorschlag für die Wertung: Anzahl mindestens das Ziel, Zeit länger als das Ziel; ohne Ziel keiner */
export function reached(r: ChallengeRun, now: number): boolean | null {
  if (r.target === null) return null
  const p = progress(r, now)
  return r.type === 'time' ? p > r.target : p >= r.target
}

/** Wertet die laufende Aufgabe; null nimmt die Wertung zurück. */
export const decide = (won: boolean | null) => (s: State): State =>
  withData(s, (d) => {
    const r = d.current
    if (!r || !r.teamId) return d
    const key = String(r.index)
    const points = { ...d.points }
    const results = { ...d.results }
    if (won === null) {
      delete points[key]
      delete results[key]
    } else {
      points[key] = won ? { [r.teamId]: WIN_POINTS } : Object.fromEntries(s.teams.filter((t) => t.id !== r.teamId).map((t) => [t.id, LOSE_POINTS]))
      results[key] = { teamId: r.teamId, won }
    }
    return { ...d, points, results, current: { ...r, verdict: won === null ? null : won ? 'won' : 'lost' } }
  })

export function challengeTotals(state: State): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(state.teams.map((t) => [t.id, 0]))
  for (const perTeam of Object.values(challengeData(state).points)) {
    for (const [id, p] of Object.entries(perTeam)) {
      if (id in out) out[id] += p
    }
  }
  return out
}

export const adjustPoints = (teamId: string, delta: number) => (s: State): State =>
  withData(s, (d) => {
    const manual = d.points[MANUAL] ?? {}
    return { ...d, points: { ...d.points, [MANUAL]: { ...manual, [teamId]: (manual[teamId] ?? 0) + delta } } }
  })
