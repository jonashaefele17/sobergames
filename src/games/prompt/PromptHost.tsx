import { useEffect, useState } from 'react'
import '../quiz/quiz.css'
import '../score/score.css'
import * as act from '../../lib/actions'
import { teamStyle } from '../../lib/motion'
import { gameStore } from '../../store'
import type { Game, State } from '../../store/types'
import { gameDef, gameName } from '../catalog'
import { questionStore, type Question } from '../quiz/questionStore'
import { awarded, awardTotals, toggleAward } from './logic'

const run = (fn: (s: State) => State) => gameStore.update(fn)

/** Regiepult einer Fragenrunde: Frage zeigen, je Team den Punkt vergeben, weiter. */
export default function PromptHost({ state, game }: { state: State; game: Game }) {
  const def = gameDef(game.id)
  const label = def.quiz?.itemLabel ?? 'Frage'
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

  const index = state.play.quiz?.index ?? -1
  const current = questions?.[index]
  const upcoming = questions?.[index + 1]
  const totals = awardTotals(state)
  const winners = index >= 0 ? awarded(state, index) : []

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
  }

  const end = () => {
    if (!confirm(`${gameName(game)} beenden und die Punkte als Platzierung übernehmen?`)) return
    run(act.endPlay(totals))
  }

  return (
    <section>
      <h2>{gameName(game)}</h2>
      {error && <p className="warn">{error}</p>}
      {questions && questions.length === 0 && (
        <p className="warn">Noch keine Einträge – im Setup bei „{def.name}“ auf „Fragen bearbeiten“ tippen.</p>
      )}

      {questions && questions.length > 0 && (
        <div className="card quiz-current">
          <span className="hint">{index < 0 ? `${questions.length} Fragen bereit` : `${label} ${index + 1} / ${questions.length}`}</span>
          <div className={`q-text${current ? '' : ' idle'}`}>{current ? current.question : `Noch keine ${label} gezeigt`}</div>
        </div>
      )}

      {current && (
        <>
          <p className="hint">Wer bekommt bei dieser Frage den Punkt?</p>
          {state.teams.map((t) => (
            <button
              key={t.id}
              className={`team-btn big-team${winners.includes(t.id) ? ' on' : ''}`}
              style={teamStyle(t.color)}
              onClick={() => run(toggleAward(index, t.id))}
            >
              {t.name}
              <b>{winners.includes(t.id) ? '+1' : totals[t.id]}</b>
            </button>
          ))}
        </>
      )}

      {questions && questions.length > 0 && (
        <button className="primary big" disabled={index >= 0 && !upcoming} onClick={() => void show(index + 1)}>
          {index < 0 ? `${label} 1 zeigen` : upcoming ? `Weiter: ${label} ${index + 2}` : 'Keine weiteren'}
        </button>
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

      <h2>Stand</h2>
      {state.teams.map((t) => (
        <div key={t.id} className="row tight" style={teamStyle(t.color)}>
          <span className="dot" />
          <span className="grow">{t.name}</span>
          <b className="round-score">{totals[t.id]}</b>
        </div>
      ))}

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
