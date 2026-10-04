import { useEffect, useState } from 'react'
import './quiz.css'
import { buzzerStore, useBuzzer } from '../../buzzer'
import { canUndo } from '../../buzzer/types'
import * as act from '../../lib/actions'
import { teamStyle } from '../../lib/motion'
import { gameStore } from '../../store'
import type { Game, State } from '../../store/types'
import { gameDef, gameName } from '../catalog'
import { questionStore, type Question } from './questionStore'

const run = (fn: (s: State) => State) => gameStore.update(fn)

function format(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Countdown nur zur Orientierung: läuft über 0 hinaus weiter, gesperrt wird nichts. */
function HostTimer({ state }: { state: State }) {
  const timer = state.play.timer
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [])
  const left = timer.durationMs - act.timerElapsed(timer, now)
  const running = timer.startedAt !== null
  const level = left <= 0 ? 'over' : left <= 5 * 60 * 1000 ? 'soon' : ''

  return (
    <div className={`host-timer ${level}`}>
      <div className="time">
        {left < 0 && '+'}
        {format(left)}
      </div>
      <div className="hint">
        {left <= 0 ? 'Zeit um – weiterspielen, solange es Spaß macht' : running ? 'läuft' : 'pausiert'}
      </div>
      <div className="row">
        {running ? (
          <button onClick={() => run(act.timerPause(Date.now()))}>Pause</button>
        ) : (
          <button className="primary" onClick={() => run(act.timerStart(Date.now()))}>
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

/** Regiepult-Steuerung eines Buzzer-Quiz: Fragen zeigen, werten, auflösen, beenden. */
export default function QuizHost({ state, game }: { state: State; game: Game }) {
  const def = gameDef(game.id)
  const label = def.quiz?.itemLabel ?? 'Frage'
  const { state: buzzer } = useBuzzer()
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    questionStore
      .list(game.id)
      .then((q) => {
        if (!cancelled) setQuestions(q)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Fragen konnten nicht geladen werden')
      })
    return () => {
      cancelled = true
    }
  }, [game.id])

  const quiz = state.play.quiz
  const index = quiz?.index ?? -1
  const current = questions?.[index]
  const upcoming = questions?.[index + 1]
  const buzzed = state.teams.find((t) => t.id === buzzer.buzzedTeamId)
  const answered = quiz?.phase === 'answer'

  const show = async (i: number) => {
    const q = questions?.[i]
    if (!q) return
    let imageUrl: string | null = null
    try {
      imageUrl = q.imagePath ? await questionStore.imageUrl(q.imagePath) : null
    } catch {
      setError('Bild konnte nicht geladen werden – Frage wird ohne Bild gezeigt')
    }
    run(act.showQuestion({ index: i, total: questions!.length, text: q.question, imageUrl }))
    buzzerStore.startQuestion()
  }

  const reveal = () => {
    if (current) run(act.revealAnswer(current.answer, current.info || null))
  }

  const correct = () => {
    buzzerStore.judge(true, { pause: true })
    reveal()
  }

  /** Vertippt? Wertung zurücknehmen; nach „Richtig“ wird auch die Antwort wieder ausgeblendet. */
  const undo = () => {
    if (buzzer.lastJudgement?.correct) run(act.reopenQuestion)
    buzzerStore.undoJudge()
  }

  /** Alle Sperren dieser Frage aufheben und den Buzzer für alle scharf schalten. */
  const releaseAll = () => {
    if (answered) run(act.reopenQuestion)
    buzzerStore.startQuestion()
  }

  const lastTeam = state.teams.find((t) => t.id === buzzer.lastJudgement?.teamId)

  const resolve = () => {
    buzzerStore.arm(false)
    reveal()
  }

  const end = () => {
    if (!confirm(`${gameName(game)} beenden und die Rundenpunkte als Platzierung übernehmen?`)) return
    run(act.endPlay(buzzer.roundScores))
    buzzerStore.arm(false)
    buzzerStore.resetRound()
  }

  const leave = () => {
    if (!confirm('Spielseite ohne Wertung verlassen? Die Rundenpunkte bleiben im Buzzer-Tab erhalten.')) return
    run(act.leavePlay)
    buzzerStore.arm(false)
  }

  return (
    <section className="quiz-host">
      <h2>{gameName(game)}</h2>
      <HostTimer state={state} />
      {error && <p className="warn">{error}</p>}
      {questions && questions.length === 0 && (
        <p className="warn">Noch keine Einträge – im Setup bei „{def.name}“ auf „Fragen“ tippen.</p>
      )}

      {questions && questions.length > 0 && (
        <div className="card quiz-current">
          <div className="row">
            <span className="hint grow">
              {index < 0 ? `${questions.length} ${label === 'Frage' ? 'Fragen' : `× ${label}`} bereit` : `${label} ${index + 1} / ${questions.length}`}
            </span>
            {quiz && <span className={`phase ${quiz.phase}`}>{answered ? 'Antwort sichtbar' : 'Frage läuft'}</span>}
          </div>
          {current ? (
            <>
              <div className="q-text">{current.question}</div>
              <div className="q-answer">
                <small>Antwort</small> {current.answer || '—'}
              </div>
              {current.info && <div className="hint">{current.info}</div>}
            </>
          ) : (
            <div className="q-text idle">Noch keine {label} gezeigt</div>
          )}
        </div>
      )}

      {buzzed && quiz?.phase === 'question' && (
        <div className="card buzz-status" style={teamStyle(buzzed.color)}>
          <div className="buzzed-name">{buzzed.name}</div>
          <div className="row">
            <button className="good big" onClick={correct}>
              Richtig
            </button>
            <button className="bad big" onClick={() => buzzerStore.judge(false)}>
              Falsch
            </button>
          </div>
          <button onClick={() => buzzerStore.release()}>Freigeben ohne Wertung</button>
        </div>
      )}
      {quiz?.phase === 'question' && (
        <div className="card team-states">
          <div className="hint">{!buzzer.armed ? 'Buzzer aus' : buzzed ? 'Gebuzzert' : 'Buzzer frei'}</div>
          {state.teams.map((t) => {
            const isBuzzed = t.id === buzzer.buzzedTeamId
            const excluded = buzzer.excludedTeamIds.includes(t.id)
            const status = isBuzzed ? 'dran' : excluded ? 'gesperrt' : buzzer.armed ? 'frei' : 'aus'
            return (
              <div key={t.id} className="row tight" style={teamStyle(t.color)}>
                <span className="dot" />
                <span className="grow">{t.name}</span>
                <span className={`team-state ${status}`}>{status}</span>
                {!isBuzzed && (
                  <button className="state-btn" onClick={() => buzzerStore.setExcluded(t.id, !excluded)}>
                    {excluded ? 'Freigeben' : 'Sperren'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {quiz && !buzzed && (
        <div className="row fix-row">
          {canUndo(buzzer) && lastTeam && (
            <button onClick={undo}>
              ↶ Rückgängig: {lastTeam.name} {buzzer.lastJudgement!.correct ? 'richtig' : 'falsch'}
            </button>
          )}
          {(answered || buzzer.excludedTeamIds.length > 1 || !buzzer.armed) && (
            <button onClick={releaseAll}>
              {answered ? 'Frage nochmal freigeben' : !buzzer.armed ? 'Buzzer scharf schalten' : 'Alle Teams freigeben'}
            </button>
          )}
        </div>
      )}

      {questions && questions.length > 0 && (
        <div className="row">
          {index < 0 ? (
            <button className="primary big" onClick={() => void show(0)}>
              Erste {label} zeigen
            </button>
          ) : (
            <>
              {quiz?.phase === 'question' && (
                <button className="big" onClick={resolve}>
                  Auflösen
                </button>
              )}
              <button className="primary big" disabled={!upcoming} onClick={() => void show(index + 1)}>
                {upcoming ? `Nächste ${label}` : 'Keine weiteren'}
              </button>
            </>
          )}
        </div>
      )}
      {index > 0 && (
        <button onClick={() => void show(index - 1)}>
          ← Zurück zu {label} {index}
        </button>
      )}
      {upcoming && index >= 0 && (
        <p className="hint">
          Als Nächstes: {upcoming.question.slice(0, 90)}
          {upcoming.question.length > 90 ? '…' : ''}
        </p>
      )}

      <h2>Runde</h2>
      {state.teams.map((t) => (
        <div key={t.id} className="row tight" style={teamStyle(t.color)}>
          <span className="dot" />
          <span className="grow">{t.name}</span>
          <button className="arrow" onClick={() => buzzerStore.adjustRound(t.id, -1)}>
            −
          </button>
          <b className="round-score">{buzzer.roundScores[t.id] ?? 0}</b>
          <button className="arrow" onClick={() => buzzerStore.adjustRound(t.id, 1)}>
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
