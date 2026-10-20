import { useEffect, useState } from 'react'
import { gameStore } from '../../store'
import type { State } from '../../store/types'
import { questionStore } from '../quiz/questionStore'
import { hideTerms, showTerms, TERMS_PER_ROUND, termRounds, termsView } from './terms'

const run = (fn: (s: State) => State) => gameStore.update(fn)

/**
 * Auflösung der Zeichenrunden (Scribble Rush): Der Host sieht alle Begriffe der
 * Runde, auf den Beamer kommen sie erst beim Aufdecken, einer nach dem anderen.
 */
export default function TermsPanel({ state, gameId, round, onRound }: { state: State; gameId: string; round: number; onRound: (round: number) => void }) {
  const [terms, setTerms] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const view = termsView(state)

  useEffect(() => {
    let cancelled = false
    questionStore
      .list(gameId)
      .then((list) => {
        if (!cancelled) setTerms(list.map((q) => q.question.trim()).filter(Boolean))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Begriffe konnten nicht geladen werden')
      })
    return () => {
      cancelled = true
    }
  }, [gameId])

  if (error) return <p className="warn">{error}</p>
  if (!terms) return <p className="hint">Lade Begriffe…</p>
  const rounds = termRounds(terms)
  if (rounds.length === 0) {
    return (
      <p className="hint">
        Noch keine Begriffe. In der <a href="#/sammeln">Sammlung</a> ⭐ setzen und „ins Spiel übernehmen“.
      </p>
    )
  }

  const r = Math.max(0, Math.min(round, rounds.length - 1))
  const list = rounds[r]
  const onBeamer = view?.round === r
  const shown = onBeamer ? view.shown.length : 0

  return (
    <div className="card terms-host">
      <div className="row tight">
        <button className="arrow" aria-label="vorige Runde" disabled={r === 0} onClick={() => onRound(r - 1)}>
          ‹
        </button>
        <span className="grow terms-title">
          Begriffe Runde {r + 1}
          <small>
            von {rounds.length}
            {list.length < TERMS_PER_ROUND && ` · nur ${list.length} ${list.length === 1 ? 'Begriff' : 'Begriffe'}`}
            {onBeamer ? ` · auf dem Beamer: ${shown} von ${list.length}` : view ? ` · Beamer zeigt Runde ${view.round + 1}` : ''}
          </small>
        </span>
        <button className="arrow" aria-label="nächste Runde" disabled={r === rounds.length - 1} onClick={() => onRound(r + 1)}>
          ›
        </button>
      </div>
      <ol className="terms-list">
        {list.map((t, i) => (
          <li key={i} className={i < shown ? 'shown' : onBeamer && i === shown ? 'next' : ''}>
            <b>{i + 1}</b>
            <span>{t}</span>
          </li>
        ))}
      </ol>
      {onBeamer ? (
        <div className="row">
          <button className="primary big" disabled={shown >= list.length} onClick={() => run(showTerms(r, list, shown + 1))}>
            {shown >= list.length ? 'Alle aufgedeckt' : `Begriff ${shown + 1} aufdecken`}
          </button>
          <button disabled={shown >= list.length} onClick={() => run(showTerms(r, list, list.length))}>
            Alle aufdecken
          </button>
          <button disabled={shown === 0} onClick={() => run(showTerms(r, list, 0))}>
            Verdecken
          </button>
          <button onClick={() => run(hideTerms)}>Zur Punktetafel</button>
        </div>
      ) : (
        <button className="primary big" onClick={() => run(showTerms(r, list, 0))}>
          Auflösung Runde {r + 1} auf den Beamer
        </button>
      )}
    </div>
  )
}
