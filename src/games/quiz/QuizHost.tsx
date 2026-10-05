import { useEffect, useState } from 'react'
import './quiz.css'
import { buzzerStore, useBuzzer } from '../../buzzer'
import { canUndo } from '../../buzzer/types'
import * as act from '../../lib/actions'
import { teamStyle } from '../../lib/motion'
import { gameStore } from '../../store'
import type { Game, ShownHint, State } from '../../store/types'
import { DEMO_ID, gameDef, gameName } from '../catalog'
import { HostTimer } from '../common/HostTimer'
import { mediaUrl } from '../common/media'
import { newQuestion, questionStore, type Hint, type Question } from './questionStore'

const run = (fn: (s: State) => State) => gameStore.update(fn)

/** die eine Frage der Buzzer-Probe; sie steht im Code, nicht in der Datenbank */
const DEMO_QUESTIONS: Question[] = [
  newQuestion({ id: 'probe-1', question: 'Unter welchem Namen ist diese Spieleolympiade noch bekannt?', answer: 'The Sober Games' }),
]

/** Regiepult-Steuerung eines Buzzer-Quiz: Fragen zeigen, werten, auflösen, beenden. */
export default function QuizHost({ state, game }: { state: State; game: Game }) {
  const def = gameDef(game.id)
  const label = def.quiz?.itemLabel ?? 'Frage'
  const demo = game.id === DEMO_ID
  const { state: buzzer } = useBuzzer()
  const [loaded, setQuestions] = useState<Question[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (demo) return
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
  }, [game.id, demo])

  const questions = demo ? DEMO_QUESTIONS : loaded
  const quiz = state.play.quiz
  const index = quiz?.index ?? -1
  const current = questions?.[index]
  const upcoming = questions?.[index + 1]
  const buzzed = state.teams.find((t) => t.id === buzzer.buzzedTeamId)
  const answered = quiz?.phase === 'answer'

  /** macht aus einem gespeicherten Hinweis einen anzeigbaren (Bild → Adresse im Medienordner) */
  const resolveHint = (hint: Hint): ShownHint | null => {
    if (hint.kind === 'text') return { kind: 'text', value: hint.value }
    const url = mediaUrl(hint.value)
    if (!url) setError('Ein Hinweis-Bild liegt nicht im Medienordner und wird übersprungen')
    return url ? { kind: 'image', value: url } : null
  }

  const show = (i: number) => {
    const q = questions?.[i]
    if (!q) return
    // der erste Hinweis erscheint sofort mit
    const first = q.hints[0] ? resolveHint(q.hints[0]) : null
    const song = mediaUrl(q.audioPath)
    if (q.audioPath && !song) setError('Der Song liegt nicht im Medienordner')
    run(
      act.showQuestion({
        index: i,
        total: questions!.length,
        // bei Spielen ohne Fragefeld (nur Lösung) bleibt ein alter Fragetext unsichtbar
        text: def.quiz?.answerOnly ? '' : q.question,
        imageUrl: mediaUrl(q.imagePath),
        hints: first ? [first] : [],
        // der Song wird gezeigt, aber noch nicht gespielt: die Stufen löst der Host aus
        ...(song ? { audio: { url: song, start: q.audioStart ?? 0, stage: -1, nonce: 0, play: 'stop' as const } } : {}),
      }),
    )
    buzzerStore.startQuestion()
  }

  const stages = def.quiz?.audio ? (def.quiz.stages ?? [1, 2, 4, 8, 16]) : null
  const seconds = (s: number) => `${s.toLocaleString('de-DE')} s`
  const shownHints = quiz?.hints?.length ?? 0
  const focusedHint = quiz?.hintFocus ?? shownHints - 1
  const nextHint = current?.hints[shownHints]

  const showNextHint = () => {
    if (!nextHint) return
    const resolved = resolveHint(nextHint)
    if (resolved) run(act.addHint(resolved))
  }

  /** zeigt die Antwort; ein Song läuft dabei von vorn und spielt durch */
  const reveal = () => {
    if (current) run((s) => act.cueAudio('full')(act.revealAnswer(current.answer, current.info || null)(s)))
  }

  /** Antwort wieder verdecken, die Musik dazu stoppt */
  const reopen = () => run((s) => act.cueAudio('stop')(act.reopenQuestion(s)))

  const correct = () => {
    buzzerStore.judge(true, { pause: true })
    reveal()
  }

  /** Vertippt? Wertung zurücknehmen; nach „Richtig“ wird auch die Antwort wieder ausgeblendet. */
  const undo = () => {
    if (buzzer.lastJudgement?.correct) reopen()
    buzzerStore.undoJudge()
  }

  /** Alle Sperren dieser Frage aufheben und den Buzzer für alle scharf schalten. */
  const releaseAll = () => {
    if (answered) reopen()
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

  const endDemo = () => {
    run(act.endDemo)
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
      {demo ? <p className="hint">Probe zum Vorführen – zählt nicht und ändert nichts am Spielstand.</p> : <HostTimer state={state} />}
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
              {current.question && !def.quiz?.answerOnly && <div className="q-text">{current.question}</div>}
              <div className={`q-answer${current.question ? '' : ' main'}`}>
                <small>{current.question ? 'Antwort' : 'Lösung'}</small> {current.answer || '—'}
              </div>
              {current.info && <div className="hint">{current.info}</div>}
              {stages && quiz?.audio && (
                <div className="song-controls">
                  <div className="hint">
                    {quiz.audio.stage < 0 ? 'Noch nichts gespielt' : `Stufe ${quiz.audio.stage + 1} / ${stages.length} · ${seconds(stages[quiz.audio.stage])}`}
                  </div>
                  <div className="row">
                    {quiz.audio.stage + 1 < stages.length && (
                      <button className="primary" onClick={() => run(act.cueAudio('stage', quiz.audio!.stage + 1))}>
                        ▶ Stufe {quiz.audio.stage + 2} ({seconds(stages[quiz.audio.stage + 1])})
                      </button>
                    )}
                    {quiz.audio.stage >= 0 && <button onClick={() => run(act.cueAudio('stage', quiz.audio!.stage))}>Nochmal</button>}
                    <button onClick={() => run(act.cueAudio('stop'))}>Stopp</button>
                  </div>
                  <button onClick={() => run(act.cueAudio('full'))}>Song ausspielen</button>
                </div>
              )}
              {stages && !quiz?.audio && <p className="warn">Zu diesem Eintrag ist kein Song gewählt.</p>}
              {current.hints.length > 0 && (
                <div className="row">
                  <span className="hint grow">
                    Hinweis {Math.min(shownHints, current.hints.length)} / {current.hints.length} gezeigt
                  </span>
                  <button className="primary" disabled={!nextHint} onClick={showNextHint}>
                    {nextHint ? `Hinweis ${shownHints + 1} zeigen` : 'Alle gezeigt'}
                  </button>
                </div>
              )}
              {shownHints > 1 && (
                <div className="row tight hint-switch">
                  <span className="hint grow">Groß zeigen</span>
                  {Array.from({ length: shownHints }, (_, i) => (
                    <button key={i} className={i === focusedHint ? 'on' : ''} onClick={() => run(act.focusHint(i))}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
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
            <button className="primary big" onClick={() => show(0)}>
              {label} 1 zeigen
            </button>
          ) : (
            <>
              {quiz?.phase === 'question' && (
                <button className="big" onClick={resolve}>
                  Auflösen
                </button>
              )}
              {demo ? (
                <button className="primary big" onClick={() => show(0)}>
                  Nochmal von vorn
                </button>
              ) : (
                <button className="primary big" disabled={!upcoming} onClick={() => show(index + 1)}>
                  {upcoming ? `Weiter: ${label} ${index + 2}` : 'Keine weiteren'}
                </button>
              )}
            </>
          )}
        </div>
      )}
      {index > 0 && (
        <button onClick={() => show(index - 1)}>
          ← Zurück zu {label} {index}
        </button>
      )}
      {upcoming && index >= 0 && (
        <p className="hint">
          Als Nächstes: {(upcoming.question || upcoming.answer).slice(0, 90)}
          {(upcoming.question || upcoming.answer).length > 90 ? '…' : ''}
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

      {demo ? (
        <div className="row">
          <button className="primary big" onClick={endDemo}>
            Probe beenden
          </button>
        </div>
      ) : (
        <>
          <div className="row">
            <button className="primary big" onClick={end}>
              Spiel beenden & werten
            </button>
          </div>
          <button onClick={leave}>Spielseite ohne Wertung verlassen</button>
        </>
      )}
    </section>
  )
}
