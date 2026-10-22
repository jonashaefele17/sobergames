import { useEffect, useState } from 'react'
import './challenge.css'
import * as act from '../../lib/actions'
import { syncedNow } from '../../lib/clock'
import { teamStyle } from '../../lib/motion'
import { gameStore } from '../../store'
import type { ChallengeRun, Game, State } from '../../store/types'
import { gameName } from '../catalog'
import { mediaUrl } from '../common/media'
import { formatStopwatch, useNow } from '../common/time'
import { questionStore, type Question } from '../quiz/questionStore'
import {
  addNamed,
  adjustPoints,
  challengeData,
  challengeTotals,
  closeChallenge,
  decide,
  formatTarget,
  LOSE_POINTS,
  progress,
  reached,
  removeNamed,
  reveal,
  revealAll,
  setCount,
  setImage,
  setLive,
  setRounds,
  setTarget,
  setTeam,
  setTimer,
  showMissed,
  showTarget,
  startChallenge,
  startTimer,
  stopTimer,
  timerMs,
  toggleNamed,
  typeLabel,
  WIN_POINTS,
} from './logic'

const run = (fn: (s: State) => State) => gameStore.update(fn)
const num = (v: string) => (v === '' ? null : Number(v))
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Regiepult für „Mein Team kann“: Aufgabe wählen, spielendes Team und Ziel
 * festlegen, je nach Baustein zählen, abhaken, eintippen oder stoppen, werten.
 */
export default function ChallengeHost({ state, game }: { state: State; game: Game }) {
  const [tasks, setTasks] = useState<Question[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const data = challengeData(state)
  const current = data.current
  const totals = challengeTotals(state)
  const name = (id: string) => state.teams.find((t) => t.id === id)?.name ?? '?'

  useEffect(() => {
    let cancelled = false
    questionStore
      .list(game.id)
      .then((list) => {
        if (!cancelled) setTasks(list)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Aufgaben konnten nicht geladen werden')
      })
    return () => {
      cancelled = true
    }
  }, [game.id])

  const start = (i: number) => {
    const t = tasks![i]
    if (current && current.verdict === null && current.teamId && !confirm(`„${current.title}“ ist noch nicht gewertet. Trotzdem wechseln?`)) return
    run(startChallenge(i, tasks!.length, t.question.trim() || `Aufgabe ${i + 1}`, t.challenge ?? { type: 'count' }))
  }

  const end = () => {
    if (!confirm(`${gameName(game)} beenden und die Punkte als Platzierung übernehmen?`)) return
    run((s) => act.endPlay(totals)(closeChallenge(stopTimer(syncedNow())(s))))
  }

  const leave = () => {
    if (!confirm('Spielseite ohne Wertung verlassen? Die Punkte dieses Spiels gehen verloren.')) return
    run(act.leavePlay)
  }

  return (
    <section className="challenge-host">
      <h2>{gameName(game)}</h2>
      {error && <p className="warn">{error}</p>}
      {tasks && tasks.length === 0 && <p className="warn">Noch keine Aufgaben – im Setup bei „{gameName(game)}“ auf „Aufgaben bearbeiten“ tippen.</p>}

      {current && tasks && <Current run={current} task={tasks[current.index]} state={state} />}

      {tasks && tasks.length > 0 && (
        <>
          <h2>{current ? 'Andere Aufgabe' : 'Aufgabe wählen'}</h2>
          <div className="ch-tasks">
            {tasks.map((t, i) => {
              const result = data.results[i]
              return (
                <button key={t.id} className={`ch-task${current?.index === i ? ' on' : ''}${result ? ' done' : ''}`} onClick={() => start(i)}>
                  <b className="num">{pad(i + 1)}</b>
                  <span className="grow">
                    {t.question || `Aufgabe ${i + 1}`}
                    <small>{typeLabel(t.challenge?.type ?? 'count')}</small>
                  </span>
                  {result && (
                    <span className={`ch-result${result.won ? ' won' : ''}`} style={teamStyle(state.teams.find((x) => x.id === result.teamId)?.color ?? '#fff')}>
                      {name(result.teamId)} {result.won ? '✓' : '✗'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      <h2>Wertung</h2>
      <p className="hint">
        Geschafft: spielendes Team +{WIN_POINTS}. Nicht geschafft: alle anderen +{LOSE_POINTS}.
      </p>
      {state.teams.map((t) => (
        <div key={t.id} className="row tight" style={teamStyle(t.color)}>
          <span className="dot" />
          <span className="grow">{t.name}</span>
          <button className="arrow" onClick={() => run(adjustPoints(t.id, -1))}>
            −
          </button>
          <b className="round-score">{totals[t.id]}</b>
          <button className="arrow" onClick={() => run(adjustPoints(t.id, 1))}>
            +
          </button>
        </div>
      ))}

      <div className="row">
        <button className="primary big" onClick={end}>
          Spiel beenden & werten
        </button>
      </div>
      <button onClick={leave}>Spielseite ohne Wertung verlassen</button>
    </section>
  )
}

/** Die laufende Aufgabe: Team, Ziel, Baustein, Wertung */
function Current({ run: r, task, state }: { run: ChallengeRun; task: Question | undefined; state: State }) {
  const running = r.timers.some((t) => t.startedAt !== null)
  const now = useNow(100, running)
  const isTime = r.type === 'time'
  const suggestion = reached(r, now)
  const team = state.teams.find((t) => t.id === r.teamId)
  const p = progress(r, now)

  return (
    <div className="card ch-current" style={teamStyle(team?.color ?? 'var(--gold)')}>
      <div className="row tight">
        <span className="hint grow">
          Aufgabe {r.index + 1} / {r.total} · {typeLabel(r.type)}
        </span>
        <button onClick={() => run((s) => closeChallenge(stopTimer(syncedNow())(s)))}>Zur Übersicht</button>
      </div>
      <div className="q-text">{r.title}</div>

      <div className="hint">Spielendes Team</div>
      <div className="row tight">
        {state.teams.map((t) => (
          <button key={t.id} className={`team-btn${r.teamId === t.id ? ' on' : ''}`} style={teamStyle(t.color)} disabled={r.verdict !== null} onClick={() => run(setTeam(t.id))}>
            {t.name}
          </button>
        ))}
      </div>

      <div className="row tight value-row">
        <span className="grow">{isTime ? 'Zielzeit' : 'Ziel'}</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}

          value={r.target === null ? '' : isTime ? r.target / 1000 : r.target}
          onChange={(e) => {
            const v = num(e.target.value)
            run(setTarget(v === null ? null : isTime ? v * 1000 : v))
          }}
        />
        <span className="unit">{isTime ? 's' : ''}</span>
        <button className={r.targetShown ? '' : 'primary'} disabled={r.target === null} onClick={() => run(showTarget(!r.targetShown))}>
          {r.targetShown ? 'Ziel verbergen' : 'Ziel aufdecken'}
        </button>
      </div>

      {r.type === 'count' && <CountPanel r={r} />}
      {r.type === 'list' && <ListPanel r={r} task={task} />}
      {r.type === 'free' && <FreePanel r={r} />}
      {isTime && <TimePanel r={r} task={task} now={now} />}

      <div className="ch-sum">
        <span className="grow">Stand</span>
        <b>
          {isTime ? formatStopwatch(p) : p}
          {r.target !== null && <small> / {isTime ? formatTarget(r.target) : r.target}</small>}
        </b>
      </div>

      {r.verdict === null ? (
        <>
          {suggestion !== null && <div className={`ch-suggest${suggestion ? ' won' : ''}`}>{suggestion ? 'Ziel erreicht' : 'Ziel noch nicht erreicht'}</div>}
          <div className="row">
            <button className={`good big${suggestion === true ? ' suggested' : ''}`} disabled={!r.teamId} onClick={() => run((s) => decide(true)(stopTimer(syncedNow())(s)))}>
              Geschafft
            </button>
            <button className={`bad big${suggestion === false && !running ? ' suggested' : ''}`} disabled={!r.teamId} onClick={() => run((s) => decide(false)(stopTimer(syncedNow())(s)))}>
              Nicht geschafft
            </button>
          </div>
          {!r.teamId && <p className="hint">Erst das spielende Team wählen.</p>}
        </>
      ) : (
        <div className="row">
          <span className={`grow ch-suggest${r.verdict === 'won' ? ' won' : ''}`}>
            {r.verdict === 'won' ? `Geschafft: ${team?.name} +${WIN_POINTS}` : `Nicht geschafft: alle anderen +${LOSE_POINTS}`}
          </span>
          <button onClick={() => run(decide(null))}>Zurücknehmen</button>
        </div>
      )}
    </div>
  )
}

function CountPanel({ r }: { r: ChallengeRun }) {
  if (!r.teamId) return <p className="hint">Mit dem Team ergibt sich die Zahl der Runden.</p>
  return (
    <>
      {r.counts.map((c, i) => (
        <div key={i} className="row tight value-row">
          <span className="grow">Runde {i + 1}</span>
          <input type="number" inputMode="numeric" min={0} value={c ?? ''} onChange={(e) => run(setCount(i, num(e.target.value)))} />
        </div>
      ))}
      <div className="row tight">
        <span className="grow hint">Runden</span>
        <button className="arrow" disabled={r.counts.length <= 1} onClick={() => run(setRounds(r.counts.length - 1))}>
          −
        </button>
        <b className="round-score">{r.counts.length}</b>
        <button className="arrow" onClick={() => run(setRounds(r.counts.length + 1))}>
          +
        </button>
      </div>
    </>
  )
}

function ListPanel({ r, task }: { r: ChallengeRun; task: Question | undefined }) {
  const all = (task?.hints ?? []).filter((h) => h.kind === 'text').map((h) => h.value)
  const [filter, setFilter] = useState('')
  const shown = filter.trim() ? all.filter((n) => n.toLocaleLowerCase('de').includes(filter.trim().toLocaleLowerCase('de'))) : all
  const hidden = r.named.filter((n) => !r.revealed.includes(n))

  return (
    <>
      <div className="seg">
        <button className={r.live ? '' : 'on'} onClick={() => run(setLive(false))}>
          Erst zählen, dann aufdecken
        </button>
        <button className={r.live ? 'on' : ''} onClick={() => run(setLive(true))}>
          Sofort zeigen
        </button>
      </div>
      {all.length === 0 && <p className="warn">Für diese Aufgabe ist keine Liste hinterlegt (Setup → Aufgaben bearbeiten).</p>}
      {all.length > 12 && <input value={filter} placeholder="Suchen…" onChange={(e) => setFilter(e.target.value)} />}
      <div className="ch-chips">
        {shown.map((n) => (
          <button key={n} className={`ch-chip${r.named.includes(n) ? ' on' : ''}`} onClick={() => run(toggleNamed(n))}>
            {n}
          </button>
        ))}
      </div>
      <div className="hint">
        Genannt: {r.named.length} von {all.length}
      </div>
      {!r.live && r.named.length > 0 && (
        <>
          <div className="hint">Aufdecken (in Nenn-Reihenfolge)</div>
          <div className="ch-chips">
            {r.named.map((n) => (
              <button key={n} className={`ch-chip${r.revealed.includes(n) ? ' shown' : ''}`} disabled={r.revealed.includes(n)} onClick={() => run(reveal(n))}>
                {n}
              </button>
            ))}
          </div>
          <div className="row">
            <button disabled={hidden.length === 0} onClick={() => run(reveal(hidden[0]))}>
              Nächsten aufdecken
            </button>
            <button disabled={hidden.length === 0} onClick={() => run(revealAll)}>
              Alle aufdecken
            </button>
          </div>
        </>
      )}
      {all.length > 0 && (
        <button onClick={() => run(showMissed(r.missed ? null : all))}>{r.missed ? 'Nicht Genannte ausblenden' : 'Nicht Genannte zeigen'}</button>
      )}
    </>
  )
}

function FreePanel({ r }: { r: ChallengeRun }) {
  const [text, setText] = useState('')
  const add = () => {
    run(addNamed(text))
    setText('')
  }
  return (
    <>
      <form
        className="row tight"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input className="grow" value={text} placeholder="Genanntes eintippen, Enter" onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="primary" disabled={!text.trim()}>
          +
        </button>
      </form>
      <div className="ch-chips">
        {[...r.named].reverse().map((n) => (
          <button key={n} className="ch-chip on" title="Entfernen" onClick={() => run(removeNamed(n))}>
            {n} ✕
          </button>
        ))}
      </div>
    </>
  )
}

function TimePanel({ r, task, now }: { r: ChallengeRun; task: Question | undefined; now: number }) {
  const images = (task?.hints ?? []).filter((h) => h.kind === 'image').map((h) => mediaUrl(h.value)).filter((u): u is string => Boolean(u))
  const at = r.image ? images.indexOf(r.image) : -1
  const busy = r.timers.some((t) => t.startedAt !== null)
  // das erste Bild startet zugleich den Timer: den nächsten unbenutzten, sonst läuft der letzte weiter
  const unused = r.timers.findIndex((t) => t.ms === 0)
  const next = unused >= 0 ? unused : r.timers.length - 1
  const show = (url: string) => run(at < 0 ? (s) => startTimer(next, syncedNow())(setImage(url)(s)) : setImage(url))

  return (
    <>
      {r.timers.map((t, i) => {
        const on = t.startedAt !== null
        return (
          <div key={i} className={`row tight ch-timer${on ? ' running' : ''}`}>
            <span className="grow">{r.timers.length > 1 ? `Timer ${i + 1}` : 'Timer'}</span>
            <b className="sw-time">{formatStopwatch(timerMs(t, now))}</b>
            {on ? (
              <button className="bad" onClick={() => run(stopTimer(syncedNow()))}>
                Stopp
              </button>
            ) : (
              <button className="good" disabled={busy} onClick={() => run(startTimer(i, syncedNow()))}>
                {t.ms > 0 ? 'Weiter' : 'Start'}
              </button>
            )}
            <button className="arrow" aria-label="Zurücksetzen" disabled={on || t.ms === 0} onClick={() => run(setTimer(i, 0))}>
              ↺
            </button>
          </div>
        )
      })}
      {images.length > 0 && (
        <>
          <div className="hint">Bilder auf dem Beamer</div>
          <div className="row">
            <button disabled={at <= 0} onClick={() => run(setImage(images[at - 1]))}>
              ←
            </button>
            <span className="grow hint ch-image-pos">{at < 0 ? 'kein Bild' : `Bild ${at + 1} / ${images.length}`}</span>
            <button className={at < 0 ? 'primary' : ''} disabled={at >= images.length - 1} onClick={() => show(images[at + 1])}>
              {at < 0 ? (busy ? 'Erstes Bild' : 'Erstes Bild + Timer starten') : '→'}
            </button>
            <button disabled={at < 0} onClick={() => run(setImage(null))}>
              Aus
            </button>
          </div>
          <div className="ch-thumbs">
            {images.map((u, i) => (
              <button key={u} className={`ch-thumb${i === at ? ' on' : ''}`} onClick={() => show(u)}>
                <img src={u} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
