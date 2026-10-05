import { useEffect, useState } from 'react'
import './estimate.css'
import '../quiz/quiz.css'
import { buzzerStore, useBuzzer } from '../../buzzer'
import * as act from '../../lib/actions'
import { teamStyle } from '../../lib/motion'
import { gameStore } from '../../store'
import type { Game, State } from '../../store/types'
import { gameDef, gameName } from '../catalog'
import { HostTimer } from '../common/HostTimer'
import { mediaUrl } from '../common/media'
import { questionStore, type Question } from '../quiz/questionStore'
import { answerStore } from './answerStore'
import NumberInput from './NumberInput'
import { adjustPoints, estimateData, estimateTotals, formatNumber, parseNumber, resetQuestion, revealGuess, revealSolution, setMode, setSubmitted } from './logic'

const run = (fn: (s: State) => State) => gameStore.update(fn)

/**
 * Regiepult der Schätzfragen: Frage zeigen, Abgaben verfolgen (ohne die Zahlen
 * zu sehen), Eingabe schließen, Teams einzeln aufdecken, Lösung zeigen.
 */
export default function EstimateHost({ state, game }: { state: State; game: Game }) {
  const def = gameDef(game.id)
  // im Schätzspiel bedeutet „scharf“: die Eingabe ist offen
  const open = useBuzzer().state.armed
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [manual, setManual] = useState<Record<string, string>>({})
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

  // Abgaben live mitlesen; öffentlich wird nur, WER abgegeben hat
  useEffect(() => {
    let cancelled = false
    const refresh = () =>
      void answerStore
        .list()
        .then((a) => {
          if (cancelled) return
          setAnswers(a)
          run(setSubmitted(Object.keys(a)))
        })
        .catch(() => undefined)
    refresh()
    const unsubscribe = answerStore.subscribe(refresh)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const data = estimateData(state)
  const quiz = state.play.quiz
  const index = quiz?.index ?? -1
  const current = questions?.[index]
  const upcoming = questions?.[index + 1]
  const solution = current ? parseNumber(current.answer) : null
  const solved = data.solution !== null
  const totals = estimateTotals(state)
  const teamAnswers = Object.fromEntries(state.teams.filter((t) => answers[t.id] !== undefined).map((t) => [t.id, answers[t.id]]))
  const hidden = state.teams.filter((t) => answers[t.id] !== undefined && data.guesses[t.id] === undefined)

  const show = (i: number) => {
    const q = questions?.[i]
    if (!q) return
    setManual({})
    void answerStore.clear().catch(() => setError('Alte Schätzungen konnten nicht gelöscht werden'))
    run((s) => resetQuestion(act.showQuestion({ index: i, total: questions!.length, text: q.question, imageUrl: mediaUrl(q.imagePath) })(s)))
    buzzerStore.arm(true)
  }

  const solve = () => {
    if (solution === null || !current) return
    buzzerStore.arm(false)
    run((s) => act.revealAnswer(formatNumber(solution), current.info || null)(revealSolution(index, solution, teamAnswers)(s)))
  }

  const end = () => {
    if (!confirm(`${gameName(game)} beenden und die Punkte als Platzierung übernehmen?`)) return
    buzzerStore.arm(false)
    run(act.endPlay(totals))
  }

  const leave = () => {
    if (!confirm('Spielseite ohne Wertung verlassen? Die Punkte dieses Spiels gehen verloren.')) return
    buzzerStore.arm(false)
    run(act.leavePlay)
  }

  return (
    <section>
      <h2>{gameName(game)}</h2>
      <HostTimer state={state} />
      {error && <p className="warn">{error}</p>}
      {questions && questions.length === 0 && <p className="warn">Noch keine Fragen – im Setup bei „{def.name}“ auf „Fragen bearbeiten“ tippen.</p>}

      {questions && questions.length > 0 && (
        <div className="card quiz-current">
          <div className="row">
            <span className="hint grow">{index < 0 ? `${questions.length} Fragen bereit` : `Frage ${index + 1} / ${questions.length}`}</span>
            {quiz && <span className={`phase ${solved ? 'answer' : ''}`}>{solved ? 'Lösung sichtbar' : open ? 'Eingabe offen' : 'Eingabe geschlossen'}</span>}
          </div>
          {current ? (
            <>
              <div className="q-text">{current.question}</div>
              <div className="q-answer">
                <small>Lösung</small> {solution !== null ? formatNumber(solution) : `„${current.answer}“ ist keine Zahl`}
              </div>
              {current.info && <div className="hint">{current.info}</div>}
            </>
          ) : (
            <div className="q-text idle">Noch keine Frage gezeigt</div>
          )}
        </div>
      )}

      {current && (
        <div className="card team-states">
          <div className="hint">Schätzungen – die Zahlen siehst du erst nach dem Aufdecken</div>
          {state.teams.map((t) => {
            const has = answers[t.id] !== undefined
            const shown = data.guesses[t.id] !== undefined
            return (
              <div key={t.id} className="row tight" style={teamStyle(t.color)}>
                <span className="dot" />
                <span className="grow">{t.name}</span>
                {shown ? (
                  <b className="guess">{formatNumber(data.guesses[t.id])}</b>
                ) : (
                  <span className={`team-state ${has ? 'frei' : ''}`}>{has ? 'abgegeben' : 'offen'}</span>
                )}
                {!open && !solved && has && !shown && (
                  <button className="state-btn" onClick={() => run(revealGuess(t.id, answers[t.id]))}>
                    Aufdecken
                  </button>
                )}
              </div>
            )
          })}
          {!solved && (
            <div className="row">
              {open ? (
                <button className="primary big" onClick={() => buzzerStore.arm(false)}>
                  Eingabe schließen
                </button>
              ) : (
                <>
                  <button onClick={() => buzzerStore.arm(true)}>Eingabe wieder öffnen</button>
                  <button disabled={hidden.length === 0} onClick={() => run((s) => hidden.reduce((acc, t) => revealGuess(t.id, answers[t.id])(acc), s))}>
                    Alle aufdecken
                  </button>
                </>
              )}
            </div>
          )}
          {!open && !solved && (
            <button className="primary big" disabled={solution === null} onClick={solve}>
              Lösung aufdecken
            </button>
          )}
          {!solved && (
            <details className="probe">
              <summary>Schätzung von Hand eintragen</summary>
              {state.teams.map((t) => (
                <div key={t.id} className="row tight value-row" style={teamStyle(t.color)}>
                  <span className="dot" />
                  <span className="grow">{t.name}</span>
                  <NumberInput placeholder="Zahl" value={manual[t.id] ?? ''} onChange={(text) => setManual((m) => ({ ...m, [t.id]: text }))} />
                  <button
                    disabled={parseNumber(manual[t.id] ?? '') === null}
                    onClick={() => {
                      void answerStore.set(t.id, parseNumber(manual[t.id])!)
                      setManual((m) => ({ ...m, [t.id]: '' }))
                    }}
                  >
                    Eintragen
                  </button>
                </div>
              ))}
            </details>
          )}
        </div>
      )}

      {questions && questions.length > 0 && (
        <button className={`big${index < 0 || solved ? ' primary' : ''}`} disabled={index >= 0 && !upcoming} onClick={() => show(index + 1)}>
          {index < 0 ? 'Frage 1 zeigen' : upcoming ? `Weiter: Frage ${index + 2}` : 'Keine weiteren'}
        </button>
      )}
      {upcoming && index >= 0 && (
        <p className="hint">
          Als Nächstes: {upcoming.question.slice(0, 90)}
          {upcoming.question.length > 90 ? '…' : ''}
        </p>
      )}

      <h2>Wertung</h2>
      <div className="seg">
        <button className={data.mode === 'nearest' ? 'on' : ''} onClick={() => run(setMode('nearest', index))}>
          Nächster 1 Punkt
        </button>
        <button className={data.mode === 'graded' ? 'on' : ''} onClick={() => run(setMode('graded', index))}>
          Abgestuft 2 / 1
        </button>
      </div>
      <p className="hint">Bei gleichem Abstand bekommen beide Teams die Punkte.</p>
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
