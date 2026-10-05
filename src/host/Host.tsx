import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import './host.css'
import * as act from '../lib/actions'
import { signInHost, signOutHost, useHostSession } from '../lib/hostAuth'
import { race } from '../lib/race'
import { gamePoints, maxSwing, standings } from '../lib/scoring'
import { SPRING, teamStyle } from '../lib/motion'
import { buzzerStore } from '../buzzer'
import { BuzzerPanel } from '../buzzer/BuzzerPanel'
import { gameDef, gameKind, gameName } from '../games/catalog'
import { KINDS } from '../games/registry'
import { gameStore, useGame } from '../store'
import type { Game, Scene, State } from '../store/types'

const run = (fn: (s: State) => State) => gameStore.update(fn)
const pad = (n: number) => String(n).padStart(2, '0')

const SCENES: [Scene, string][] = [
  ['intro', 'Logo'],
  ['wheel', 'Glücksrad'],
  ['teams', 'Teams'],
  ['games', 'Spiele'],
  ['scoreboard', 'Tabelle'],
  ['winner', 'Sieger'],
]

// so lange braucht die Show für Dreh + Namenseinblendung
const SPIN_LOCK_MS = 9000

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(await signInHost(username, password))
    setSubmitting(false)
  }

  return (
    <form className="host login" onSubmit={handleSubmit}>
      <h1>Host-Login</h1>
      <label>
        Benutzername
        <input type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
      </label>
      <label>
        Passwort
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="primary" disabled={submitting}>
        {submitting ? 'Anmelden…' : 'Anmelden'}
      </button>
    </form>
  )
}

const placeLabel = (place: number) => `${place + 1}.`

/** Kurzfassung des Titelrennens: offen, Matchball oder entschieden. */
function RaceBox({ state }: { state: State }) {
  const info = race(state)
  const n = state.games.length
  const names = (teams: { name: string }[]) => teams.map((t) => t.name).join(', ')
  const next = info.nextGame !== null ? info.nextGame + 1 : null

  let line: React.ReactNode
  let color: string | undefined
  if (info.status === 'decided' && info.decidedFor) {
    color = info.decidedFor.color
    line = <>Entschieden: {info.decidedFor.name} ist nicht mehr einzuholen</>
  } else if (info.status === 'matchball') {
    color = info.matchball[0].team.color
    line = info.matchball.map((m) => (
      <span key={m.team.id} className="race-line">
        <b>Matchball {m.team.name}</b> – {m.clinchPlace === 0 ? 'ein Sieg' : `schon Platz ${m.clinchPlace + 1}`} in Spiel {next}{' '}
        entscheidet
      </span>
    ))
  } else {
    line = <>Offen · noch im Rennen: {names(info.contenders)}</>
  }

  // erst warnen, wenn das vorzeitige Ende in den nächsten beiden Spielen droht
  const early = info.earliestEnd !== null && info.earliestEnd < n && next !== null && info.earliestEnd - next <= 1
  return (
    <div className="race-box" style={color ? teamStyle(color) : undefined}>
      <div className="race-status">{line}</div>
      {info.status !== 'decided' && info.earliestEnd !== null && (
        <p className={early ? 'warn' : 'hint'}>
          Frühestens entschieden nach Spiel {info.earliestEnd}
          {early && ' – das Finale könnte bedeutungslos werden. Ggf. im Setup die Reihenfolge ändern.'}
        </p>
      )}
      {info.status !== 'decided' && info.earliestEnd === null && info.nextGame !== null && (
        <p className="hint">Bleibt bis zum Schluss offen – das Finale entscheidet in jedem Fall mit</p>
      )}
    </div>
  )
}

function Standings({ state }: { state: State }) {
  const table = standings(state)
  return (
    <div className="standings">
      {table.map((row) => (
        <div key={row.team.id} className="standing" style={teamStyle(row.team.color)}>
          <span>
            {row.rank}. {row.team.name}
          </span>
          <b>{row.points}</b>
        </div>
      ))}
      <p className="hint">Noch aufholbar: {maxSwing(state)} Punkte</p>
    </div>
  )
}

// ---------- Auslosung ----------

function DrawPanel({ state }: { state: State }) {
  const [locked, setLocked] = useState(false)
  const free = act.unassignedPlayers(state)

  useEffect(() => {
    if (!locked) return
    const id = window.setTimeout(() => setLocked(false), SPIN_LOCK_MS)
    return () => window.clearTimeout(id)
  }, [locked])

  return (
    <section>
      <div className="row">
        <button
          className="primary big"
          disabled={locked || free.length === 0}
          onClick={() => {
            run(act.spinWheel())
            setLocked(true)
          }}
        >
          {locked ? 'Rad dreht…' : free.length ? `Drehen (${free.length} übrig)` : 'Alle verteilt'}
        </button>
      </div>
      <div className="row">
        <button disabled={free.length === 0} onClick={() => run(act.assignRest())}>
          Rest sofort verteilen
        </button>
        <button
          onClick={() => {
            if (confirm('Auslosung zurücksetzen? Alle Spieler kommen zurück aufs Rad.')) run(act.clearAssignment)
          }}
        >
          Neu auslosen
        </button>
      </div>

      {free.length > 0 && <p className="hint">Auf dem Rad: {free.map((p) => p.name).join(', ')}</p>}

      {state.teams.map((team, i) => (
        <div key={team.id} className="card" style={teamStyle(team.color)}>
          <div className="row">
            <span className="dot" />
            <input
              className="grow"
              value={team.name}
              placeholder={`Team ${i + 1}`}
              onChange={(e) => run(act.updateTeam(team.id, { name: e.target.value }))}
            />
          </div>
          {team.playerIds.map((id) => (
            <div key={id} className="row tight">
              <span className="grow">{state.players.find((p) => p.id === id)?.name}</span>
              <select value={team.id} onChange={(e) => run(act.movePlayer(id, e.target.value || null))}>
                {state.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
                <option value="">zurück aufs Rad</option>
              </select>
            </div>
          ))}
          {team.playerIds.length === 0 && <p className="hint">noch leer</p>}
        </div>
      ))}
    </section>
  )
}

// ---------- Spiele ----------

function PlaceButtons({ game, place, points, state }: { game: Game; place: number; points: number; state: State }) {
  return (
    <div className="row tight">
      <span className="place">
        {placeLabel(place)}
        <small>{points}</small>
      </span>
      {state.teams.map((team) => (
        <button
          key={team.id}
          className={`team-btn${game.result?.places[place]?.includes(team.id) ? ' on' : ''}`}
          style={teamStyle(team.color)}
          onClick={() => run(act.togglePlace(game.id, place, team.id))}
        >
          {team.name}
        </button>
      ))}
    </div>
  )
}

function GamesPanel({ state, onStart }: { state: State; onStart: (gameId: string) => void }) {
  const [adjTeam, setAdjTeam] = useState('')
  const [adjDelta, setAdjDelta] = useState(1)
  const [adjNote, setAdjNote] = useState('')
  const teamId = adjTeam || state.teams[0]?.id

  return (
    <section>
      <Standings state={state} />
      <RaceBox state={state} />
      <label className="check">
        <input type="checkbox" checked={state.showTicker} onChange={() => run(act.toggleTicker)} />
        Punkteleiste unter den Spielen zeigen
      </label>
      <label className="check">
        <input type="checkbox" checked={state.showRaceHints} onChange={() => run(act.toggleRaceHints)} />
        Matchball-Hinweise auf der Show zeigen
      </label>

      {state.games.map((game, i) => {
        const pts = gamePoints(i, state)
        const finale = i === state.games.length - 1
        return (
          <div key={game.id} className={`card${game.result ? ' done' : ''}${finale ? ' finale' : ''}`}>
            <div className="row">
              <b className="num">{pad(i + 1)}</b>
              <span className="grow">
                {gameName(game)}
                {finale && <span className="tag">Finale ×{state.scoring.finaleFactor}</span>}
              </span>
              {KINDS[gameKind(game)].Host && (
                <button className={state.play.gameId === game.id ? 'on' : ''} onClick={() => onStart(game.id)}>
                  {state.play.gameId === game.id ? 'Läuft' : 'Spiel starten'}
                </button>
              )}
              {game.revealed ? (
                <button onClick={() => run(act.hideGame(game.id))}>Verdecken</button>
              ) : (
                <button className="primary" onClick={() => run(act.revealGame(game.id))}>
                  Aufdecken
                </button>
              )}
            </div>
            {state.teams.map((_, place) => (
              <PlaceButtons key={place} game={game} place={place} points={pts[place] ?? 0} state={state} />
            ))}
          </div>
        )
      })}

      <h2>Punkte korrigieren</h2>
      <div className="row">
        <select value={teamId} onChange={(e) => setAdjTeam(e.target.value)}>
          {state.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input type="number" className="short" value={adjDelta} onChange={(e) => setAdjDelta(Number(e.target.value))} />
        <input className="grow" placeholder="Grund (optional)" value={adjNote} onChange={(e) => setAdjNote(e.target.value)} />
        <button
          disabled={!teamId || !adjDelta}
          onClick={() => {
            run(act.addAdjustment(teamId, adjDelta, adjNote))
            setAdjNote('')
          }}
        >
          Buchen
        </button>
      </div>
      {state.adjustments.map((a) => (
        <div key={a.id} className="row tight">
          <span className="grow">
            {state.teams.find((t) => t.id === a.teamId)?.name}: {a.delta > 0 ? '+' : ''}
            {a.delta} {a.note && `(${a.note})`}
          </span>
          <button onClick={() => run(act.removeAdjustment(a.id))}>Entfernen</button>
        </div>
      ))}
    </section>
  )
}

// ---------- Setup ----------

function SetupPanel({ state, onEdit }: { state: State; onEdit: (gameId: string) => void }) {
  const [names, setNames] = useState('')
  const assigned = state.teams.some((t) => t.playerIds.length > 0)

  const addNames = () => {
    run(act.addPlayers(names.split(/[\n,;]+/)))
    setNames('')
  }

  return (
    <section>
      <h2>Spieler ({state.players.length})</h2>
      <textarea
        rows={3}
        placeholder="Namen eintragen – einer pro Zeile oder mit Komma getrennt"
        value={names}
        onChange={(e) => setNames(e.target.value)}
      />
      <button className="primary" disabled={!names.trim()} onClick={addNames}>
        Hinzufügen
      </button>
      {state.players.map((p) => (
        <div key={p.id} className="row tight">
          <input className="grow" value={p.name} onChange={(e) => run(act.renamePlayer(p.id, e.target.value))} />
          <button onClick={() => run(act.removePlayer(p.id))}>Löschen</button>
        </div>
      ))}

      <h2>Teams</h2>
      <div className="row">
        <span className="grow">Anzahl Teams</span>
        <select
          value={state.teams.length}
          onChange={(e) => {
            if (!assigned || confirm('Teamanzahl ändern? Die Auslosung beginnt dann von vorn.')) run(act.setTeamCount(Number(e.target.value)))
          }}
        >
          {[2, 3, 4, 5, 6].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </div>
      {state.teams.map((team) => (
        <div key={team.id} className="row tight">
          <input type="color" value={team.color} onChange={(e) => run(act.updateTeam(team.id, { color: e.target.value }))} />
          <input className="grow" value={team.name} onChange={(e) => run(act.updateTeam(team.id, { name: e.target.value }))} />
        </div>
      ))}

      <h2>Wertung</h2>
      <div className="row">
        <span className="grow">Punkte für Platz 1 / 2 / 3</span>
        {[0, 1, 2].map((place) => (
          <input
            key={place}
            type="number"
            className="short"
            min={0}
            value={state.scoring.placePoints[place] ?? 0}
            onChange={(e) => {
              const placePoints = [...state.scoring.placePoints]
              placePoints[place] = Number(e.target.value)
              run(act.updateScoring({ placePoints }))
            }}
          />
        ))}
      </div>
      <div className="row">
        <span className="grow">Faktor Finale (letztes Spiel)</span>
        <input
          type="number"
          className="short"
          min={1}
          value={state.scoring.finaleFactor}
          onChange={(e) => run(act.updateScoring({ finaleFactor: Number(e.target.value) }))}
        />
      </div>
      <p className="hint">
        Normales Spiel: {state.scoring.placePoints.join(' / ')} Punkte. Finale:{' '}
        {state.scoring.placePoints.map((p) => p * state.scoring.finaleFactor).join(' / ')} Punkte. Weitere Plätze bekommen 0.
      </p>

      <h2>Spiele</h2>
      <p className="hint">Mit ↑ / ↓ umsortieren. Das letzte Spiel ist immer das Finale. Gewertete Spiele bleiben fest.</p>
      {state.games.map((game, i) => {
        const def = gameDef(game.id)
        const kind = KINDS[def.kind]
        const locked = Boolean(game.result)
        const finale = i === state.games.length - 1
        return (
          <motion.div key={game.id} layout transition={SPRING} className={`game-row${finale ? ' finale' : ''}`}>
            <div className="row tight">
              <b className="num">{pad(i + 1)}</b>
              <span className="grow game-title">
                {gameName(game)}
                <small>
                  {def.category}
                  {def.kind !== 'plain' && ` · ${kind.label}`}
                </small>
              </span>
              {locked ? (
                <span className="lock" title="Bereits gewertet">
                  🔒
                </span>
              ) : (
                <>
                  <button className="arrow" aria-label="nach oben" onClick={() => run(act.shiftGame(game.id, -1))}>
                    ↑
                  </button>
                  <button className="arrow" aria-label="nach unten" onClick={() => run(act.shiftGame(game.id, 1))}>
                    ↓
                  </button>
                </>
              )}
            </div>
            {(def.variants || kind.Editor || finale) && (
              <div className="row tight">
                <span className="num" />
                {def.variants && (
                  <div className="seg">
                    {def.variants.map((v) => (
                      <button
                        key={v.key}
                        className={(game.variant ?? def.variants![0].key) === v.key ? 'on' : ''}
                        title={v.note}
                        onClick={() => run(act.setVariant(game.id, v.key))}
                      >
                        {v.name}
                      </button>
                    ))}
                  </div>
                )}
                {kind.Editor && <button onClick={() => onEdit(game.id)}>{kind.dataLabel ?? 'Daten'} bearbeiten</button>}
                <span className="grow" />
                {finale && <span className="tag">Finale ×{state.scoring.finaleFactor}</span>}
              </div>
            )}
          </motion.div>
        )
      })}
    </section>
  )
}

// ---------- Reset ----------

function ResetPanel() {
  const ask = (text: string, fn: (s: State) => State) => () => {
    if (confirm(text)) run(fn)
  }
  return (
    <section>
      <p className="hint">Nach einer Probe „Punkte + Auslosung zurücksetzen“: Spieler, Teamnamen und Spieleliste bleiben erhalten.</p>
      <button onClick={ask('Alle Ergebnisse löschen und Spiele wieder verdecken?', act.resetScores)}>
        Punkte zurücksetzen
        <small>Ergebnisse und Aufdeckungen weg, Teams bleiben</small>
      </button>
      <button onClick={ask('Ergebnisse UND Teamauslosung löschen?', act.resetScoresAndTeams)}>
        Punkte + Auslosung zurücksetzen
        <small>Spieler, Teamnamen und Spieleliste bleiben</small>
      </button>
      <button className="danger" onClick={ask('Wirklich ALLES löschen, auch Spieler und Spieleliste?', act.resetAll)}>
        Alles zurücksetzen
        <small>komplett leerer Stand</small>
      </button>
    </section>
  )
}

type Tab = 'draw' | 'games' | 'play' | 'buzzer' | 'setup' | 'reset'
const TABS: [Tab, string][] = [
  ['draw', 'Auslosung'],
  ['games', 'Spiele'],
  ['play', 'Spiel'],
  ['buzzer', 'Buzzer'],
  ['setup', 'Setup'],
  ['reset', 'Reset'],
]

/** Regiepult für Laptop und Handy. */
export default function Host() {
  const session = useHostSession()
  const { ready, state, unsaved: snapshotUnsaved } = useGame()
  const [tab, setTab] = useState<Tab>('setup')
  const [editing, setEditing] = useState<string | null>(null)

  if (session === 'loading' || !ready) return <div className="host">Lade…</div>
  if (session === null) return <Login />

  const playing = state.games.find((g) => g.id === state.play.gameId)
  const PlayHost = playing ? KINDS[gameKind(playing)].Host : undefined
  const Editor = editing ? KINDS[gameDef(editing).kind].Editor : undefined
  const tabs = TABS.filter(([key]) => key !== 'play' || playing)

  const start = (gameId: string) => {
    if (state.play.gameId !== gameId) {
      if (state.play.gameId && !confirm('Es läuft schon ein Spiel. Trotzdem wechseln?')) return
      run(act.startPlay(gameId))
      buzzerStore.arm(false)
      buzzerStore.resetRound()
    } else {
      run(act.setScene('play'))
    }
    setTab('play')
  }

  return (
    <div className="host">
      <header className="row">
        <h1 className="grow">Regiepult</h1>
      </header>
      {snapshotUnsaved && <p className="warn">Nicht gespeichert – keine Verbindung. Wird automatisch erneut versucht.</p>}
      {session === 'local' && <p className="hint">Lokaler Modus: Stand liegt nur in diesem Browser (keine Supabase-Zugangsdaten).</p>}

      <div className="scenes">
        {SCENES.map(([scene, label]) => (
          <button key={scene} className={state.scene === scene ? 'on' : ''} onClick={() => run(act.setScene(scene))}>
            {label}
          </button>
        ))}
      </div>
      {playing && state.scene !== 'play' && (
        <button onClick={() => run(act.setScene('play'))}>Zurück zur Spielseite: {gameName(playing)}</button>
      )}
      {state.scene === 'intro' && <button onClick={() => run(act.replayIntro)}>Logo-Intro neu abspielen</button>}

      <nav className="tabs">
        {tabs.map(([key, label]) => (
          <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'draw' && <DrawPanel state={state} />}
      {tab === 'games' && <GamesPanel state={state} onStart={start} />}
      {tab === 'play' && (playing && PlayHost ? <PlayHost state={state} game={playing} /> : <p className="hint">Kein Spiel läuft.</p>)}
      {tab === 'buzzer' && <BuzzerPanel state={state} />}
      {tab === 'setup' && <SetupPanel state={state} onEdit={setEditing} />}
      {editing && Editor && <Editor gameId={editing} onClose={() => setEditing(null)} />}
      {tab === 'reset' && <ResetPanel />}

      <footer className="row">
        <a href="#/" target="_blank" rel="noreferrer">
          Show-Ansicht öffnen
        </a>
        <span className="grow" />
        {session !== 'local' && <button onClick={() => void signOutHost()}>Abmelden</button>}
      </footer>
    </div>
  )
}
