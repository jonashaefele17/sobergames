import { useEffect, useState } from 'react'
import { WSShield } from '../components/shared'
import { gameDef } from '../games/catalog'
import { questionStore } from '../games/quiz/questionStore'
import { termRounds } from '../games/score/terms'

/**
 * Druckansicht der Begriffe im Spiel: je Runde eine A4-Seite quer mit den
 * nummerierten Kästchen. „Als PDF speichern“ im Druckdialog ergibt das PDF.
 */
export default function PrintTerms({ gameId, perRound, onClose }: { gameId: string; perRound: number; onClose: () => void }) {
  const [terms, setTerms] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const name = gameDef(gameId).name

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

  const rounds = terms ? termRounds(terms) : []

  return (
    <div className="print-view">
      <div className="print-bar row">
        <span className="grow hint">
          {rounds.length ? `${rounds.length} Seiten · gedruckt wird, was im Spiel steht` : ''}
        </span>
        <button onClick={onClose}>Schließen</button>
        <button className="primary" disabled={!rounds.length} onClick={() => window.print()}>
          Drucken / PDF
        </button>
      </div>
      {error && <p className="warn">{error}</p>}
      {terms && !rounds.length && <p className="hint">Im Spiel stehen noch keine Begriffe. Erst die ⭐ ins Spiel übernehmen.</p>}
      {rounds.map((list, r) => (
        <section key={r} className="print-page">
          <header className="print-head">
            <WSShield />
            <div className="grow">
              <h1>{name}</h1>
              <span className="print-kicker">The Sober Games · Lösungsblatt</span>
            </div>
            <div className="print-round">
              <small>Runde</small>
              <b>{r + 1}</b>
            </div>
          </header>
          <div className="print-grid">
            {Array.from({ length: perRound }, (_, i) => (
              <div key={i} className={`print-cell${list[i] ? '' : ' empty'}`}>
                <b>{i + 1}</b>
                <span>{list[i] ?? ''}</span>
              </div>
            ))}
          </div>
          <footer className="print-foot">
            <span>Nicht den Teams zeigen</span>
            {list.length < perRound && <span>nur {list.length} {list.length === 1 ? 'Begriff' : 'Begriffe'} in dieser Runde</span>}
          </footer>
        </section>
      ))}
    </div>
  )
}
