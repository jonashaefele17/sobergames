import './countdown.css'
import * as act from '../../lib/actions'
import { teamStyle } from '../../lib/motion'
import { enableSound, finishSound, heartbeat, toggleSound, useSoundEnabled } from '../../lib/sound'
import { gameStore } from '../../store'
import type { Game, State } from '../../store/types'
import { gameDef, gameName } from '../catalog'
import { HostTimer } from '../common/HostTimer'
import { useCountdown } from './useCountdown'

const run = (fn: (s: State) => State) => gameStore.update(fn)

/** Regiepult eines Countdown-Spiels: Timer steuern, danach Messwerte eintragen und werten. */
export default function CountdownHost({ state, game }: { state: State; game: Game }) {
  const def = gameDef(game.id)
  const values = state.play.data.values ?? {}
  const complete = state.teams.every((t) => values[t.id] !== undefined)
  const sound = useSoundEnabled()
  // zählt mit, damit der Ton auch auf diesem Gerät kommen kann
  useCountdown(state.play.timer)

  const testSound = () => {
    enableSound()
    heartbeat(3)
    window.setTimeout(() => heartbeat(1), 1000)
    window.setTimeout(finishSound, 2000)
  }

  const end = () => {
    const missing = complete ? '' : ' Teams ohne Wert landen auf dem letzten Platz.'
    if (!confirm(`${gameName(game)} beenden und werten? Der höchste Wert gewinnt.${missing}`)) return
    run(act.endPlayRanked(values, false))
  }

  return (
    <section>
      <h2>{gameName(game)}</h2>
      <HostTimer state={state} overText="Zeit um" />
      <p className="hint">
        Der Countdown läuft groß auf dem Beamer. In den letzten 10 Sekunden pocht es, bei 0 kommt der Schlusston. Im Beamer-Fenster
        dafür einmal klicken oder eine Taste drücken (z. B. F für Vollbild).
      </p>
      <label className="check">
        <input type="checkbox" checked={sound} onChange={() => toggleSound()} />
        Ton auf diesem Gerät abspielen
      </label>
      <button onClick={testSound}>Ton testen</button>

      <h2>Ergebnis{def.unit ? ` in ${def.unit}` : ''}</h2>
      {state.teams.map((t) => (
        <div key={t.id} className="row tight value-row" style={teamStyle(t.color)}>
          <span className="dot" />
          <span className="grow">{t.name}</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="–"
            value={values[t.id] ?? ''}
            onChange={(e) => run(act.setPlayValue(t.id, e.target.value === '' ? null : Number(e.target.value)))}
          />
          <span className="unit">{def.unit}</span>
        </div>
      ))}
      <p className="hint">Eingetragene Werte erscheinen sofort auf dem Beamer. Der höchste gewinnt.</p>

      <div className="row">
        <button className="primary big" disabled={Object.keys(values).length === 0} onClick={end}>
          Spiel beenden & werten
        </button>
      </div>
      <button
        onClick={() => {
          if (confirm('Spielseite ohne Wertung verlassen?')) run(act.leavePlay)
        }}
      >
        Spielseite ohne Wertung verlassen
      </button>
    </section>
  )
}
