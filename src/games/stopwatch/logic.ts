import type { State, StopwatchData } from '../../store/types'

export const stopwatchData = (state: State): StopwatchData => state.play.data.stopwatch ?? { times: {}, running: null }

const withData = (s: State, fn: (d: StopwatchData) => StopwatchData): State => ({
  ...s,
  play: { ...s.play, data: { ...s.play.data, stopwatch: fn(stopwatchData(s)) } },
})

/** Startet die Uhr für ein Team; solange eine Uhr läuft, startet keine zweite. */
export const start = (teamId: string, now: number) => (s: State): State =>
  stopwatchData(s).running ? s : withData(s, (d) => ({ ...d, running: { teamId, startedAt: now } }))

/** Stoppt die laufende Uhr und hält die Zeit des Teams fest. */
export const stop = (now: number) => (s: State): State => {
  const { running } = stopwatchData(s)
  if (!running) return s
  return withData(s, (d) => ({
    times: { ...d.times, [running.teamId]: Math.max(0, now - running.startedAt) },
    running: null,
  }))
}

/** Zeit von Hand setzen (ms) oder mit null löschen, z. B. für einen neuen Versuch. */
export const setTime = (teamId: string, ms: number | null) => (s: State): State =>
  withData(s, (d) => {
    const times = { ...d.times }
    if (ms === null) delete times[teamId]
    else times[teamId] = Math.max(0, ms)
    return { times, running: d.running?.teamId === teamId ? null : d.running }
  })
