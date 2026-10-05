import './stopwatch.css'
import * as act from '../../lib/actions'
import { syncedNow } from '../../lib/clock'
import { teamStyle } from '../../lib/motion'
import { gameStore } from '../../store'
import type { Game, State } from '../../store/types'
import { gameName } from '../catalog'
import { formatStopwatch, useNow } from '../common/time'
import { setTime, start, stop, stopwatchData } from './logic'

const run = (fn: (s: State) => State) => gameStore.update(fn)

/** Regiepult der Stoppuhr: je Team starten und stoppen, Zeiten korrigieren, werten. */
export default function StopwatchHost({ state, game }: { state: State; game: Game }) {
  const data = stopwatchData(state)
  const now = useNow(50, data.running !== null)
  const complete = state.teams.every((t) => data.times[t.id] !== undefined)

  const end = () => {
    const missing = complete ? '' : ' Teams ohne Zeit landen auf dem letzten Platz.'
    if (!confirm(`${gameName(game)} beenden und werten? Die kürzeste Zeit gewinnt.${missing}`)) return
    run(act.endPlayRanked(data.times, true))
  }

  return (
    <section>
      <h2>{gameName(game)}</h2>
      {state.teams.map((t) => {
        const running = data.running?.teamId === t.id
        const time = running ? now - data.running!.startedAt : data.times[t.id]
        return (
          <div key={t.id} className={`card sw-team${running ? ' running' : ''}`} style={teamStyle(t.color)}>
            <div className="row tight">
              <span className="dot" />
              <span className="grow">{t.name}</span>
              <b className="sw-time">{time !== undefined ? formatStopwatch(time) : '–'}</b>
            </div>
            {running ? (
              <button className="bad big" onClick={() => run(stop(syncedNow()))}>
                Stopp
              </button>
            ) : (
              <button className="good big" disabled={data.running !== null} onClick={() => run(start(t.id, syncedNow()))}>
                {data.times[t.id] !== undefined ? 'Neu starten' : 'Start'}
              </button>
            )}
            {!running && data.times[t.id] !== undefined && (
              <div className="row tight value-row">
                <span className="grow hint">Zeit korrigieren</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  value={Math.round(data.times[t.id] / 10) / 100}
                  onChange={(e) => run(setTime(t.id, Number(e.target.value) * 1000))}
                />
                <span className="unit">s</span>
                <button
                  onClick={() => {
                    if (confirm(`Zeit von ${t.name} löschen?`)) run(setTime(t.id, null))
                  }}
                >
                  Löschen
                </button>
              </div>
            )}
          </div>
        )
      })}

      <div className="row">
        <button className="primary big" disabled={Object.keys(data.times).length === 0 || data.running !== null} onClick={end}>
          Spiel beenden & werten
        </button>
      </div>
      <button
        onClick={() => {
          if (confirm('Spielseite ohne Wertung verlassen? Die Zeiten gehen verloren.')) run(act.leavePlay)
        }}
      >
        Spielseite ohne Wertung verlassen
      </button>
    </section>
  )
}
