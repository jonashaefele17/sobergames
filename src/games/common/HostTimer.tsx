import * as act from '../../lib/actions'
import { gameStore } from '../../store'
import type { State } from '../../store/types'
import { syncedNow } from '../../lib/clock'
import { formatClock, useNow } from './time'

const run = (fn: (s: State) => State) => gameStore.update(fn)

/**
 * Timer im Regiepult. Läuft über 0 hinaus weiter und sperrt nichts; ob er nur
 * Orientierung ist oder als Countdown auf dem Beamer steht, entscheidet die Spielart.
 */
export function HostTimer({ state, overText = 'Zeit um – weiterspielen, solange es Spaß macht' }: { state: State; overText?: string }) {
  const timer = state.play.timer
  const now = useNow(250)
  const left = timer.durationMs - act.timerElapsed(timer, now)
  const running = timer.startedAt !== null
  const level = left <= 0 ? 'over' : left <= Math.min(5 * 60 * 1000, timer.durationMs / 5) ? 'soon' : ''

  return (
    <div className={`host-timer ${level}`}>
      <div className="time">
        {left < 0 && '+'}
        {formatClock(left)}
      </div>
      <div className="hint">{left <= 0 ? overText : running ? 'läuft' : 'pausiert'}</div>
      <div className="row">
        {running ? (
          <button onClick={() => run(act.timerPause(syncedNow()))}>Pause</button>
        ) : (
          <button className="primary" onClick={() => run(act.timerStart(syncedNow()))}>
            {timer.elapsedMs ? 'Weiter' : 'Start'}
          </button>
        )}
        <button
          onClick={() => {
            if (confirm('Timer zurücksetzen?')) run(act.timerReset)
          }}
        >
          Zurücksetzen
        </button>
        <label className="minutes">
          <input
            type="number"
            min={1}
            className="short"
            value={Math.round(timer.durationMs / 60000)}
            onChange={(e) => run(act.timerSetDuration(Number(e.target.value) || 1))}
          />
          min
        </label>
      </div>
    </div>
  )
}
