import { useState } from 'react'
import './score.css'
import * as act from '../../lib/actions'
import { teamStyle } from '../../lib/motion'
import { gameStore } from '../../store'
import type { Game, State } from '../../store/types'
import { gameDef, gameName } from '../catalog'
import { addRound, reached, removeRound, scoreData, setShot, setShotCount, setTarget, teamShots, totals, undoRound } from './logic'

const run = (fn: (s: State) => State) => gameStore.update(fn)

/** Regiepult der Punktetafel: Runden buchen, korrigieren, Ziel setzen, werten. */
export default function ScoreHost({ state, game }: { state: State; game: Game }) {
  const config = gameDef(game.id).score ?? { mode: 'free' as const }
  const data = scoreData(state)
  const teamIds = state.teams.map((t) => t.id)
  const sum = totals(data, teamIds)
  const done = reached(data, teamIds)
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [picked, setPicked] = useState<{ teamId: string; index: number } | null>(null)
  const shotMode = config.mode === 'shots'

  /** ausgewählter Versuch, sonst der nächste offene des ersten Teams, das noch Versuche hat */
  const current =
    picked ??
    state.teams
      .map((t) => ({ teamId: t.id, index: teamShots(data, t.id).indexOf(null) }))
      .find((c) => c.index >= 0) ??
    null

  const enterShot = (value: number | null) => {
    if (!current) return
    run(setShot(current.teamId, current.index, value))
    // weiter zum nächsten offenen Versuch desselben Teams
    const shots = teamShots(data, current.teamId)
    shots[current.index] = value
    const next = shots.indexOf(null)
    setPicked(value !== null && next >= 0 ? { teamId: current.teamId, index: next } : null)
  }

  const bookDraft = () => {
    run(addRound(draft))
    setDraft({})
  }

  const end = () => {
    if (!confirm(`${gameName(game)} beenden und die Punkte als Platzierung übernehmen?`)) return
    run(act.endPlay(sum))
  }

  const name = (id: string) => state.teams.find((t) => t.id === id)?.name ?? '?'

  return (
    <section className="score-host">
      <h2>{gameName(game)}</h2>
      {done.length > 0 && <p className="warn">Gewonnen: {done.map(name).join(', ')}</p>}

      {shotMode && (
        <>
          <p className="hint">Versuch antippen, dann die Punkte wählen. Jeder Versuch lässt sich jederzeit ändern.</p>
          {state.teams.map((t) => (
            <div key={t.id} className="card shot-team" style={teamStyle(t.color)}>
              <div className="row tight">
                <span className="dot" />
                <span className="grow">{t.name}</span>
                <b className="round-score">{sum[t.id]}</b>
              </div>
              <div className="shot-row">
                {teamShots(data, t.id).map((p, i) => (
                  <button
                    key={i}
                    className={`shot${p !== null ? ' filled' : ''}${current?.teamId === t.id && current.index === i ? ' current' : ''}`}
                    aria-label={`${t.name} Versuch ${i + 1}`}
                    onClick={() => setPicked({ teamId: t.id, index: i })}
                  >
                    {p ?? i + 1}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {current ? (
            <div className="card shot-entry" style={teamStyle(state.teams.find((t) => t.id === current.teamId)?.color ?? '#fff')}>
              <div className="hint">
                {name(current.teamId)} · Versuch {current.index + 1}
              </div>
              <div className="row">
                {(config.steps ?? [0, 1, 2, 3]).map((n) => (
                  <button key={n} className="step big" onClick={() => enterShot(n)}>
                    {n}
                  </button>
                ))}
                <button onClick={() => enterShot(null)}>leeren</button>
              </div>
            </div>
          ) : (
            <p className="hint">Alle Versuche eingetragen.</p>
          )}
          <div className="row">
            <span className="grow">Versuche je Team</span>
            <input
              type="number"
              min={1}
              max={20}
              className="short"
              value={data.shotCount ?? 6}
              onChange={(e) => {
                setPicked(null)
                run(setShotCount(Number(e.target.value)))
              }}
            />
          </div>
        </>
      )}

      {config.mode === 'winner' && (
        <>
          <p className="hint">Runde {data.rounds.length + 1}: Wer gewinnt?</p>
          {state.teams.map((t) => (
            <button key={t.id} className="team-btn big-team" style={teamStyle(t.color)} onClick={() => run(addRound({ [t.id]: 1 }))}>
              Runde an {t.name}
              <b>{sum[t.id]}</b>
            </button>
          ))}
        </>
      )}

      {config.mode === 'steps' &&
        state.teams.map((t) => (
          <div key={t.id} className="row tight" style={teamStyle(t.color)}>
            <span className="dot" />
            <span className="grow">{t.name}</span>
            <b className="round-score">{sum[t.id]}</b>
            {(config.steps ?? [1]).map((n) => (
              <button key={n} className="step" onClick={() => run(addRound({ [t.id]: n }))}>
                +{n}
              </button>
            ))}
          </div>
        ))}

      {(config.mode === 'round' || config.mode === 'free') && (
        <>
          <p className="hint">
            Runde {data.rounds.length + 1}
            {config.max !== undefined && ` · 0 bis ${config.max} Punkte je Team`}
          </p>
          {state.teams.map((t) => {
            const value = draft[t.id] ?? 0
            const set = (v: number) => {
              const min = config.mode === 'free' ? -99 : 0
              setDraft((d) => ({ ...d, [t.id]: Math.max(min, Math.min(config.max ?? 99, v)) }))
            }
            return (
              <div key={t.id} className="row tight" style={teamStyle(t.color)}>
                <span className="dot" />
                <span className="grow">
                  {t.name} <small>gesamt {sum[t.id]}</small>
                </span>
                <button className="arrow" onClick={() => set(value - 1)}>
                  −
                </button>
                <input type="number" className="short" value={value} onChange={(e) => set(Number(e.target.value) || 0)} />
                <button className="arrow" onClick={() => set(value + 1)}>
                  +
                </button>
              </div>
            )
          })}
          <button className="primary big" disabled={!Object.values(draft).some((v) => v !== 0)} onClick={bookDraft}>
            Runde buchen
          </button>
        </>
      )}

      {!shotMode && (
      <>
      <div className="row">
        <span className="grow">Zielpunktzahl (0 = ohne)</span>
        <input
          type="number"
          min={0}
          className="short"
          value={data.target ?? 0}
          onChange={(e) => run(setTarget(Number(e.target.value) || null))}
        />
      </div>

      <h2>Verlauf</h2>
      {data.rounds.length === 0 && <p className="hint">Noch nichts gebucht.</p>}
      {data.rounds.length > 0 && <button onClick={() => run(undoRound)}>↶ Letzte Buchung rückgängig</button>}
      {[...data.rounds].reverse().map((r, i) => (
        <div key={r.id} className="row tight">
          <b className="num">{data.rounds.length - i}</b>
          <span className="grow">
            {Object.entries(r.points)
              .map(([id, p]) => `${name(id)} ${p > 0 ? '+' : ''}${p}`)
              .join(' · ')}
          </span>
          <button
            aria-label="Buchung löschen"
            onClick={() => {
              if (confirm('Diese Buchung löschen?')) run(removeRound(r.id))
            }}
          >
            ✕
          </button>
        </div>
      ))}
      </>
      )}

      <div className="row">
        <button className="primary big" onClick={end}>
          Spiel beenden & werten
        </button>
      </div>
      <button
        onClick={() => {
          if (confirm('Spielseite ohne Wertung verlassen? Die Punkte dieses Spiels gehen verloren.')) run(act.leavePlay)
        }}
      >
        Spielseite ohne Wertung verlassen
      </button>
    </section>
  )
}
